/**
 * @file GrepTool.ts
 * @description High-performance regex / substring content search across files.
 * Supports line numbering, context lines, glob filtering, case-insensitivity, and result pagination.
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS } from '../../constants/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_GREP_LIMIT = 50;
const MAX_GREP_OUTPUT_CHARS = 20_000; // ~5k tokens safety cap
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB skip for massive binaries / bundles

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.next',
  'dist',
  'build',
  '.cache',
  'coverage',
]);

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const GrepSchema = z.object({
  tagline: z
    .string()
    .describe(
      "A concise 2-5 word present-tense summary of what this specific tool call is doing, e.g. 'Reading src/main.ts', 'Searching for test fixtures'. Used for status logging.",
    ),
  pattern: z.string().describe('The regular expression or string pattern to search for.'),
  path: z
    .string()
    .optional()
    .describe(
      'Directory or file to search within. Defaults to current working directory if omitted.',
    ),
  glob: z
    .string()
    .optional()
    .describe('Glob filter to restrict scanned files (e.g. "*.ts", "src/**/*.tsx").'),
  caseInsensitive: z
    .boolean()
    .optional()
    .describe('Whether to perform case-insensitive matching. Defaults to false.'),
  case_insensitive: z.boolean().optional().describe('Alias for caseInsensitive.'),
  context: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .describe('Number of context lines to display before and after each match.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of matching lines to return. Defaults to 50.'),
});

export type GrepInput = z.infer<typeof GrepSchema>;

export interface GrepMatch {
  file: string;
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

export interface GrepData {
  pattern: string;
  searchDir: string;
  matches: GrepMatch[];
  matchedFilesCount: number;
  totalMatches: number;
  isTruncated: boolean;
  durationMs: number;
}

// ─── GrepTool Implementation ──────────────────────────────────────────────────

export class GrepTool extends Tool<GrepInput, GrepData> {
  readonly name = 'grep';
  readonly glyph = TOOL_GLYPHS.grep;
  readonly description =
    'Search file contents using regular expressions or text patterns. Returns matching lines with file paths, line numbers, and optional context.';
  readonly schema = GrepSchema;
  override readonly isDangerous = false;

  private resolveSearchPath(targetPath: string | undefined, cwd: string): string {
    if (!targetPath) return cwd;
    const trimmed = targetPath.trim();
    if (trimmed.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(home, trimmed.slice(1).replace(/^[/\\]/, ''));
    }
    return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
  }

  private async collectCandidateFiles(
    targetPath: string,
    globFilter?: string,
  ): Promise<{ files: string[]; rootDir: string }> {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return { files: [targetPath], rootDir: path.dirname(targetPath) };
    }

    const globPattern = globFilter?.trim() || '**/*';
    const scanner = new Bun.Glob(globPattern);
    const files: string[] = [];

    for await (const entry of scanner.scan({
      cwd: targetPath,
      onlyFiles: true,
      dot: false,
    })) {
      const segments = entry.split(/[/\\]/);
      const isIgnored = segments.some((segment) => DEFAULT_IGNORED_DIRS.has(segment));
      if (isIgnored && !globPattern.includes(segments[0])) {
        continue;
      }
      files.push(path.resolve(targetPath, entry));
    }

    return { files, rootDir: targetPath };
  }

  async execute(params: GrepInput, context: ToolContext): Promise<ToolExecutionResult<GrepData>> {
    const startTime = Date.now();
    const targetPath = this.resolveSearchPath(params.path, context.cwd);

    if (!existsSync(targetPath)) {
      return this.error(`Search path does not exist: '${params.path || targetPath}'`);
    }

    const isCaseInsensitive = Boolean(params.caseInsensitive || params.case_insensitive);
    let regex: RegExp;
    try {
      const flags = isCaseInsensitive ? 'iu' : 'u';
      regex = new RegExp(params.pattern, flags);
    } catch {
      // Fallback to literal pattern if regex is malformed
      const escaped = params.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(escaped, isCaseInsensitive ? 'i' : '');
    }

    try {
      const { files, rootDir } = await this.collectCandidateFiles(targetPath, params.glob);
      const limit = Math.min(params.limit ?? DEFAULT_GREP_LIMIT, 100);
      const contextLines = params.context ?? 0;

      const matches: GrepMatch[] = [];
      const matchedFilesSet = new Set<string>();
      let totalMatches = 0;

      for (const file of files) {
        if (context.signal?.aborted) break;

        try {
          const stat = await fs.stat(file);
          if (stat.size > DEFAULT_MAX_FILE_SIZE) continue;

          const content = await fs.readFile(file, 'utf8');
          // Skip binary files
          if (content.includes('\0')) continue;

          const lines = content.split(/\r?\n/);
          const relativeFile = path.relative(context.cwd, file) || path.basename(file);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (regex.test(line)) {
              totalMatches++;
              matchedFilesSet.add(relativeFile);

              if (matches.length < limit) {
                const match: GrepMatch = {
                  file: relativeFile,
                  line: i + 1,
                  content: line,
                };

                if (contextLines > 0) {
                  const startBefore = Math.max(0, i - contextLines);
                  const endAfter = Math.min(lines.length, i + contextLines + 1);
                  match.contextBefore = lines.slice(startBefore, i);
                  match.contextAfter = lines.slice(i + 1, endAfter);
                }

                matches.push(match);
              }
            }
          }
        } catch {
          // Ignore read errors on inaccessible files
          continue;
        }
      }

      const durationMs = Date.now() - startTime;
      const isTruncated = totalMatches > matches.length;

      let outputText: string;
      if (matches.length === 0) {
        outputText = `No matches found for pattern '${params.pattern}'`;
      } else {
        const outputLines: string[] = [];
        let currentFile = '';

        for (const match of matches) {
          if (match.file !== currentFile) {
            currentFile = match.file;
            outputLines.push(`\n--- ${currentFile} ---`);
          }

          if (match.contextBefore && match.contextBefore.length > 0) {
            const startLine = match.line - match.contextBefore.length;
            match.contextBefore.forEach((ctxLine, idx) => {
              outputLines.push(`  ${startLine + idx} - ${ctxLine}`);
            });
          }

          outputLines.push(`  ${match.line} : ${match.content}`);

          if (match.contextAfter && match.contextAfter.length > 0) {
            match.contextAfter.forEach((ctxLine, idx) => {
              outputLines.push(`  ${match.line + 1 + idx} - ${ctxLine}`);
            });
          }
        }

        if (isTruncated) {
          outputLines.push(
            `\n(Showing ${matches.length} of ${totalMatches} matches. Narrow your search with path or glob options.)`,
          );
        }

        outputText = outputLines.join('\n').trim();
        if (outputText.length > MAX_GREP_OUTPUT_CHARS) {
          outputText =
            outputText.slice(0, MAX_GREP_OUTPUT_CHARS) +
            '\n\n... [Output truncated to preserve context window. Narrow your search with a more specific path or glob filter.]';
        }
      }

      return this.success(
        outputText,
        {
          pattern: params.pattern,
          searchDir: rootDir,
          matches,
          matchedFilesCount: matchedFilesSet.size,
          totalMatches,
          isTruncated,
          durationMs,
        },
        {
          matchesCount: matches.length,
          totalMatches,
          filesCount: matchedFilesSet.size,
          durationMs,
        },
      );
    } catch (err) {
      return this.error(`Grep search failed for '${params.pattern}'`, err);
    }
  }
}
