import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const globInputSchema = z.object({
  pattern: z
    .string()
    .describe('Glob pattern to match files against (e.g. "**/*.ts", "src/*.json").'),
  path: z.string().optional().describe('Starting directory path. Defaults to workspace root.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of matching file paths to return. Defaults to 100.'),
});

export type GlobInput = z.infer<typeof globInputSchema>;

export interface GlobOutput {
  pattern: string;
  files: string[];
  totalMatches: number;
  durationMs: number;
  isTruncated: boolean;
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  '.next',
  '.turbo',
]);

// Safety rails so a huge tree can never hang the agent.
const MAX_SCANNED_ENTRIES = 200_000;
const MAX_COLLECTED_MATCHES = 10_000;
const TIME_BUDGET_MS = 10_000;
const CONCURRENCY = 16;

const GLOB_CHARS = /[*?[\]{}]/;

function escapeRegexChar(c: string): string {
  return /[.+^${}()|[\]\\*?]/.test(c) ? `\\${c}` : c;
}

/**
 * Translates glob syntax to a regex *source* (no anchors).
 * Supports: `**` (any depth, incl. zero dirs for `**\/`), `*`, `?`,
 * `[abc]` / `[!abc]` classes, `{a,b}` alternation (nestable), and `\` escapes.
 */
function globToRegexSource(glob: string): string {
  // Only treat braces as alternation when they balance; otherwise they are literals.
  let depth = 0;
  let balanced = true;
  for (const c of glob) {
    if (c === '{') depth++;
    else if (c === '}' && --depth < 0) balanced = false;
  }
  if (depth !== 0) balanced = false;

  let out = '';
  let braces = 0;
  let i = 0;
  while (i < glob.length) {
    const c = glob[i]!;

    if (c === '*') {
      let j = i;
      while (glob[j] === '*') j++;
      const isDoubleStar = j - i >= 2;
      const atSegmentStart = i === 0 || glob[i - 1] === '/';
      if (isDoubleStar && atSegmentStart && glob[j] === '/') {
        out += '(?:.*/)?'; // "**/" matches zero or more directories
        i = j + 1;
      } else if (isDoubleStar && atSegmentStart && j === glob.length) {
        out += '.*'; // trailing "**" matches everything below
        i = j;
      } else {
        out += '[^/]*';
        i = j;
      }
      continue;
    }

    if (c === '?') {
      out += '[^/]';
      i++;
      continue;
    }

    if (c === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end !== -1) {
        let body = glob.slice(i + 1, end).replace(/\\/g, '\\\\');
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        out += `[${body}]`;
        i = end + 1;
        continue;
      }
    }

    if (balanced && c === '{') {
      braces++;
      out += '(?:';
      i++;
      continue;
    }
    if (balanced && c === '}' && braces > 0) {
      braces--;
      out += ')';
      i++;
      continue;
    }
    if (balanced && c === ',' && braces > 0) {
      out += '|';
      i++;
      continue;
    }

    if (c === '\\' && i + 1 < glob.length) {
      out += escapeRegexChar(glob[i + 1]!);
      i += 2;
      continue;
    }

    out += escapeRegexChar(c);
    i++;
  }
  return out;
}

function globToRegex(glob: string): RegExp | null {
  try {
    return new RegExp(`^${globToRegexSource(glob)}$`, 'i');
  } catch {
    return null; // malformed pattern: caller falls back to substring matching
  }
}

// ---------- .gitignore support (built-in, no dependencies) ----------

interface IgnoreRule {
  /** Directory holding the .gitignore, relative to workspace root, with trailing "/" ('' = root). */
  base: string;
  regex: RegExp;
  negate: boolean;
  dirOnly: boolean;
}

function parseGitignore(text: string, base: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.replace(/(?<!\\)\s+$/, '');
    if (!line || line.startsWith('#')) continue;

    let negate = false;
    if (line.startsWith('!')) {
      negate = true;
      line = line.slice(1);
    } else if (line.startsWith('\\!') || line.startsWith('\\#')) {
      line = line.slice(1);
    }

    let dirOnly = false;
    if (line.endsWith('/')) {
      dirOnly = true;
      line = line.slice(0, -1);
    }
    if (!line) continue;

    // A slash at the start or middle anchors the pattern to the .gitignore's directory.
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);

    try {
      const src = globToRegexSource(line);
      const regex = new RegExp(anchored ? `^${src}$` : `^(?:.*/)?${src}$`);
      rules.push({ base, regex, negate, dirOnly });
    } catch {
      // Skip malformed ignore lines instead of failing the whole search.
    }
  }
  return rules;
}

async function loadGitignore(dirAbs: string, base: string): Promise<IgnoreRule[]> {
  try {
    return parseGitignore(await readFile(join(dirAbs, '.gitignore'), 'utf8'), base);
  } catch {
    return [];
  }
}

/** Rules are ordered shallow -> deep; the last matching rule wins (so deeper files override). */
function isIgnored(rules: IgnoreRule[], relFromRoot: string, isDir: boolean): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.base && !relFromRoot.startsWith(rule.base)) continue;
    if (rule.dirOnly && !isDir) continue;
    const sub = relFromRoot.slice(rule.base.length);
    if (sub && rule.regex.test(sub)) ignored = !rule.negate;
  }
  return ignored;
}

// ---------- path helpers ----------

const toPosix = (p: string): string => (sep === '/' ? p : p.split(sep).join('/'));

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** Small async semaphore to cap concurrent readdir calls. */
function createLimiter(max: number) {
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    async acquire(): Promise<void> {
      if (active < max) {
        active++;
        return;
      }
      await new Promise<void>((resolveWaiter) => waiters.push(resolveWaiter));
    },
    release(): void {
      const next = waiters.shift();
      if (next) next();
      else active--;
    },
  };
}

interface Match {
  path: string;
  mtimeMs: number;
}

/**
 * Glob Tool:
 * - Finds filesystem paths matching a glob or substring pattern.
 * - Dedicated deterministic filesystem-search capability (read-only, no checkpointing).
 */
export const globTool: ToolDefinition<typeof globInputSchema, GlobOutput> = {
  name: 'glob',
  displayName: 'Glob',
  access: 'read',
  description:
    'Finds files matching a glob pattern or file name in the workspace. Read-only search capability with bounded results.',
  parameters: globInputSchema,
  confirmationPolicy: 'never',

  summarize: (_args, result) => {
    const count = result?.totalMatches ?? 0;
    return `Found ${count} file${count === 1 ? '' : 's'}`;
  },

  execute: async (args, context) => {
    const startTime = Date.now();
    const cwd = resolve(context.cwd);
    const searchRoot = args.path
      ? isAbsolute(args.path)
        ? resolve(args.path)
        : resolve(cwd, args.path)
      : cwd;

    // Lexical containment check, then realpath so symlinks cannot escape the workspace.
    if (!isInside(cwd, searchRoot)) {
      throw new Error(
        `Access denied: path "${args.path}" resolves outside the trusted workspace root ("${context.cwd}").`,
      );
    }
    try {
      if (!isInside(await realpath(cwd), await realpath(searchRoot))) {
        throw new Error(
          `Access denied: path "${args.path}" resolves outside the trusted workspace root ("${context.cwd}").`,
        );
      }
      if (!(await stat(searchRoot)).isDirectory()) {
        throw new Error(`Not a directory: "${args.path}".`);
      }
    } catch (err) {
      if (err instanceof Error && /^(Access denied|Not a directory)/.test(err.message)) throw err;
      throw new Error(`Directory not found: "${args.path ?? '.'}".`);
    }

    const limit = args.limit ?? 100;

    // Normalize the pattern: backslashes, leading "./", absolute-inside-root, and ".." guard.
    let pattern = args.pattern.trim().replace(/\\/g, '/');
    if (isAbsolute(pattern)) {
      const rel = relative(searchRoot, pattern);
      if (!isInside(searchRoot, resolve(searchRoot, rel))) {
        throw new Error(
          `Pattern "${args.pattern}" points outside the search root. Use the "path" parameter.`,
        );
      }
      pattern = toPosix(rel);
    }
    while (pattern.startsWith('./')) pattern = pattern.slice(2);
    if (pattern.split('/').includes('..')) {
      throw new Error('Pattern must not contain "..". Use the "path" parameter instead.');
    }

    const hasGlobChars = GLOB_CHARS.test(pattern);
    const regex = globToRegex(pattern);
    const lowerPattern = pattern.toLowerCase();
    const slashless = !pattern.includes('/');

    // Matched against the path relative to the search root (so `src/*.ts` + path=pkg works).
    const matcher = (relFromSearchRoot: string, fileName: string): boolean => {
      if (regex && (regex.test(relFromSearchRoot) || (slashless && regex.test(fileName)))) {
        return true;
      }
      // Plain words (no glob characters) keep the original fuzzy substring behavior.
      return !hasGlobChars && relFromSearchRoot.toLowerCase().includes(lowerPattern);
    };

    const rootRelToCwd = toPosix(relative(cwd, searchRoot));
    const limiter = createLimiter(CONCURRENCY);
    const found: Match[] = [];
    let scanned = 0;
    let stoppedEarly = false;

    const shouldStop = (): boolean => {
      if (stoppedEarly) return true;
      if (
        scanned > MAX_SCANNED_ENTRIES ||
        found.length >= MAX_COLLECTED_MATCHES ||
        Date.now() - startTime > TIME_BUDGET_MS
      ) {
        stoppedEarly = true;
      }
      return stoppedEarly;
    };

    // .gitignore files from the workspace root down to the search root's parent.
    const inheritedRules: IgnoreRule[] = [];
    {
      const segments = rootRelToCwd ? rootRelToCwd.split('/') : [];
      let dir = cwd;
      let base = '';
      for (const seg of segments) {
        inheritedRules.push(...(await loadGitignore(dir, base)));
        dir = join(dir, seg);
        base += `${seg}/`;
      }
    }

    const walk = async (
      dirAbs: string,
      relFromCwd: string,
      relFromRoot: string,
      parentRules: IgnoreRule[],
    ): Promise<void> => {
      if (shouldStop()) return;

      let entries;
      await limiter.acquire();
      try {
        entries = await readdir(dirAbs, { withFileTypes: true });
      } catch {
        return; // Skip permission errors in unreadable directories
      } finally {
        limiter.release();
      }

      const rules = [
        ...parentRules,
        ...(await loadGitignore(dirAbs, relFromCwd ? `${relFromCwd}/` : '')),
      ];
      const children: Array<Promise<void>> = [];

      for (const entry of entries) {
        if (shouldStop()) break;
        scanned++;

        const childCwd = relFromCwd ? `${relFromCwd}/${entry.name}` : entry.name;
        const childRoot = relFromRoot ? `${relFromRoot}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (IGNORED_DIRS.has(entry.name)) continue;
          if (isIgnored(rules, childCwd, true)) continue;
          children.push(walk(join(dirAbs, entry.name), childCwd, childRoot, rules));
        } else if (entry.isFile()) {
          if (isIgnored(rules, childCwd, false)) continue;
          if (!matcher(childRoot, entry.name)) continue;
          let mtimeMs = 0;
          try {
            mtimeMs = (await stat(join(dirAbs, entry.name))).mtimeMs;
          } catch {
            // File vanished mid-scan: keep it, sorted last.
          }
          found.push({ path: childCwd, mtimeMs });
        }
      }

      await Promise.all(children);
    };

    await walk(searchRoot, rootRelToCwd, '', inheritedRules);

    // Newest first (most likely the files the agent cares about), then alphabetical for stability.
    found.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));

    return {
      pattern: args.pattern,
      files: found.slice(0, limit).map((m) => m.path),
      totalMatches: found.length,
      durationMs: Date.now() - startTime,
      isTruncated: found.length > limit || stoppedEarly,
    };
  },
};
