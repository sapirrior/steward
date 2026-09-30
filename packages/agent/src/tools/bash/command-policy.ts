import { existsSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve, sep } from 'node:path';

export type CommandPolicyDecision = 'SAFE_READ_ONLY' | 'REQUIRES_APPROVAL' | 'BLOCKED';

/**
 * Expands leading ~ in path strings to user's home directory.
 */
function expandHome(filepath: string): string {
  if (filepath === '~') {
    return homedir();
  }
  if (filepath.startsWith('~/') || filepath.startsWith('~\\')) {
    return resolve(homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Normalizes a base folder path for containment checks (resolves symlinks, strips trailing slash).
 */
function normalizeRoot(inputPath: string): string {
  let absolute = resolve(inputPath);
  try {
    absolute = realpathSync(absolute);
  } catch {}

  if (absolute.length > 1 && absolute.endsWith(sep)) {
    absolute = absolute.slice(0, -1);
  }

  if (process.platform === 'darwin' || process.platform === 'win32') {
    return absolute.toLowerCase();
  }
  return absolute;
}

/**
 * Checks if target path is safely contained within workspace base directory.
 */
function isContainedInWorkspace(targetPath: string, workspaceRoot: string): boolean {
  const normTarget = normalizeRoot(targetPath);
  const normBase = normalizeRoot(workspaceRoot);

  if (normTarget === normBase) {
    return true;
  }
  const prefix = normBase.endsWith(sep) ? normBase : `${normBase}${sep}`;
  return normTarget.startsWith(prefix);
}

/**
 * Commands that take no mutating arguments and produce only stdout/inspection.
 */
const SAFE_EXACT_STANDALONE = new Set([
  'pwd',
  'whoami',
  'id',
  'hostname',
  'date',
  'uptime',
  'uname',
]);

/**
 * Splits a command line string into top-level shell commands respecting quotes.
 */
function splitChainedCommands(command: string): string[] {
  const chunks: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (
        char === ';' ||
        char === '\n' ||
        (char === '&' && command[i + 1] === '&') ||
        (char === '|' && command[i + 1] === '|')
      ) {
        if (current.trim()) chunks.push(current.trim());
        current = '';
        if (char === '&' || char === '|') i++;
        continue;
      }
      if (char === '|' && command[i + 1] !== '|') {
        if (current.trim()) chunks.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Checks if a single command fragment contains shell redirection, backgrounding, subshells, or command substitutions.
 * ANY redirection (> >> < << 1> 2> 2>&1 &>), subshell ($(), ``), or backgrounding (&) strictly REQUIRES_APPROVAL.
 */
function hasUnsafeShellConstructs(cmd: string): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i]!;

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      // Redirection or pipes
      if (char === '>' || char === '<') return true;
      // Command substitution $(...) or `...`
      if (char === '`' || (char === '$' && cmd[i + 1] === '(')) return true;
      // Backgrounding or control operators
      if (char === '&') return true;
      // Subshells or process substitution
      if (char === '(' || char === ')' || char === '{' || char === '}') return true;
      // Heredocs
      if (char === '<' && cmd[i + 1] === '<') return true;
    }
  }

  return false;
}

/**
 * Splits command arguments safely respecting quotes.
 */
function parseTokens(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i]!;

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Checks if path arguments are strictly contained within the workspace root.
 * If any path points outside the workspace root (including resolved symlinks), returns false.
 */
function arePathTokensInsideWorkspace(tokens: string[], startIndex: number, cwd: string): boolean {
  for (let i = startIndex; i < tokens.length; i++) {
    const tok = tokens[i]!;
    // Skip flags/options
    if (tok.startsWith('-')) {
      continue;
    }

    const expanded = expandHome(tok);
    const resolved = isAbsolute(expanded) ? resolve(expanded) : resolve(cwd, expanded);
    if (!isContainedInWorkspace(resolved, cwd)) {
      return false;
    }

    if (existsSync(resolved)) {
      try {
        const real = realpathSync(resolved);
        if (!isContainedInWorkspace(real, cwd)) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validates whether a given token list is strictly read-only for known safe tools.
 */
function isStrictlyReadOnlyCommand(tokens: string[], cwd?: string): boolean {
  if (tokens.length === 0) return true;

  const exe = tokens[0]!.toLowerCase();

  // Standalone commands that must have no arguments or only pure info flags
  if (SAFE_EXACT_STANDALONE.has(exe)) {
    return true;
  }

  // which / where
  if (exe === 'which' || exe === 'where') {
    return tokens.length <= 5;
  }

  // git commands
  if (exe === 'git') {
    if (tokens.length === 1) return true;
    const sub = tokens[1]?.toLowerCase();
    if (!sub) return true;

    // Only strictly read-only git subcommands
    const safeGitSubs = new Set([
      'status',
      'diff',
      'log',
      'show',
      'branch',
      'tag',
      'rev-parse',
      'describe',
    ]);
    if (!safeGitSubs.has(sub)) {
      return false;
    }

    // Check dangerous flags in git commands that could write or execute
    for (let i = 2; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (
        tok.startsWith('--output') ||
        tok === '-o' ||
        tok.startsWith('--exec') ||
        tok.startsWith('--ext-diff') ||
        tok.startsWith('--textconv') ||
        tok === '-d' ||
        tok === '-D' ||
        tok === '--delete'
      ) {
        return false;
      }
    }

    if (cwd && !arePathTokensInsideWorkspace(tokens, 2, cwd)) {
      return false;
    }

    return true;
  }

  // ls
  if (exe === 'ls') {
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  // echo / printf
  if (exe === 'echo' || exe === 'printf') {
    return true;
  }

  // head / tail / wc
  if (exe === 'head' || exe === 'tail' || exe === 'wc') {
    // Check for unbounded DoS flags (e.g. tail -f, head -c <huge>)
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok === '-f' || tok === '--follow') {
        return false;
      }
    }
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  // cat - strictly read-only when no flags or only formatting/line-number flags (-n, -b, -v, -E, -T, -s, -u)
  if (exe === 'cat') {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok.startsWith('-')) {
        // Only allow standard display flags
        if (!/^-[nbvETsuA]+$/.test(tok) && tok !== '--number' && tok !== '--show-all') {
          return false;
        }
      }
    }
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  // grep
  if (exe === 'grep') {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok === '-f' || tok.startsWith('--file') || tok === '--null-data') {
        return false;
      }
    }
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  // rg (ripgrep)
  if (exe === 'rg') {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (
        tok === '--exec' ||
        tok.startsWith('--exec=') ||
        tok === '-r' ||
        tok.startsWith('--replace') ||
        tok.startsWith('--pre') ||
        tok.startsWith('--hostname')
      ) {
        return false;
      }
    }
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  // find
  if (exe === 'find') {
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (
        tok === '-exec' ||
        tok === '-execdir' ||
        tok === '-ok' ||
        tok === '-okdir' ||
        tok === '-delete' ||
        tok === '-fprint' ||
        tok === '-fprint0' ||
        tok === '-fprintf' ||
        tok === '-fls'
      ) {
        return false;
      }
    }
    if (cwd && !arePathTokensInsideWorkspace(tokens, 1, cwd)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Evaluates a single command segment.
 */
function classifySingleSegment(segment: string, cwd?: string): CommandPolicyDecision {
  const trimmed = segment.trim();
  if (!trimmed) return 'SAFE_READ_ONLY';

  if (hasUnsafeShellConstructs(trimmed)) {
    return 'REQUIRES_APPROVAL';
  }

  const tokens = parseTokens(trimmed);
  if (tokens.length === 0) return 'SAFE_READ_ONLY';

  if (isStrictlyReadOnlyCommand(tokens, cwd)) {
    return 'SAFE_READ_ONLY';
  }

  return 'REQUIRES_APPROVAL';
}

/**
 * Classifies an arbitrary shell command into SAFE_READ_ONLY or REQUIRES_APPROVAL.
 */
export function classifyCommand(command: string, cwd?: string): CommandPolicyDecision {
  const trimmed = command.trim();
  if (!trimmed) return 'SAFE_READ_ONLY';

  const segments = splitChainedCommands(trimmed);
  if (segments.length === 0) return 'SAFE_READ_ONLY';

  for (const seg of segments) {
    const decision = classifySingleSegment(seg, cwd);
    if (decision !== 'SAFE_READ_ONLY') {
      return decision;
    }
  }

  return 'SAFE_READ_ONLY';
}
