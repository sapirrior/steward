/**
 * @file GlobTool.ts
 * @description Fast file tree search by glob wildcard pattern using native Bun.Glob.
 * Relativizes paths to save LLM tokens, applies sensible ignore defaults, and enforces result limits.
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS } from '../../constants/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_GLOB_LIMIT = 100;
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

export const GlobSchema = z.object({
  tagline: z
    .string()
    .describe(
      "A concise 2-5 word present-tense summary of what this specific tool call is doing, e.g. 'Reading src/main.ts', 'Searching for test fixtures'. Used for status logging.",
    ),
  pattern: z
    .string()
    .describe('The glob pattern to match files against (e.g. "**/*.ts", "src/**/*.tsx").'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in. Defaults to current working directory if omitted.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('Maximum number of file paths to return. Defaults to 100.'),
});

export type GlobInput = z.infer<typeof GlobSchema>;

export interface GlobData {
  pattern: string;
  searchDir: string;
  files: string[];
  totalMatches: number;
  isTruncated: boolean;
  durationMs: number;
}

// ─── GlobTool Implementation ──────────────────────────────────────────────────

export class GlobTool extends Tool<GlobInput, GlobData> {
  readonly name = 'glob';
  readonly glyph = TOOL_GLYPHS.glob;
  readonly description =
    'Find files matching a glob wildcard pattern (e.g. "**/*.ts", "src/**/*.tsx"). Fast and optimized for LLM token usage.';
  readonly schema = GlobSchema;
  override readonly isDangerous = false;

  private resolveSearchDir(targetDir: string | undefined, cwd: string): string {
    if (!targetDir) return cwd;
    const trimmed = targetDir.trim();
    if (trimmed.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(home, trimmed.slice(1).replace(/^[/\\]/, ''));
    }
    return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
  }

  async execute(params: GlobInput, context: ToolContext): Promise<ToolExecutionResult<GlobData>> {
    const startTime = Date.now();
    const searchDir = this.resolveSearchDir(params.path, context.cwd);

    if (!existsSync(searchDir)) {
      return this.error(`Search directory does not exist: '${params.path || searchDir}'`);
    }

    try {
      const stat = await fs.stat(searchDir);
      if (!stat.isDirectory()) {
        return this.error(
          `Specified search path is not a directory: '${params.path || searchDir}'`,
        );
      }
    } catch (err) {
      return this.error(`Failed to inspect search directory: '${params.path || searchDir}'`, err);
    }

    try {
      const pattern = params.pattern.trim() || '**/*';
      const globScanner = new Bun.Glob(pattern);
      const limit = params.limit ?? DEFAULT_GLOB_LIMIT;

      const matchedFiles: string[] = [];
      let totalFound = 0;

      for await (const entry of globScanner.scan({
        cwd: searchDir,
        onlyFiles: true,
        dot: false,
      })) {
        // Skip ignored root folders unless explicitly targeted in pattern
        const segments = entry.split(/[/\\]/);
        const hasIgnoredSegment = segments.some((segment) => DEFAULT_IGNORED_DIRS.has(segment));

        if (hasIgnoredSegment && !pattern.includes(segments[0])) {
          continue;
        }

        totalFound++;
        if (matchedFiles.length < limit) {
          matchedFiles.push(entry);
        }
      }

      // Sort alphabetically for deterministic ordering
      matchedFiles.sort();

      const durationMs = Date.now() - startTime;
      const isTruncated = totalFound > matchedFiles.length;

      let outputText: string;
      if (matchedFiles.length === 0) {
        outputText = `No files found matching '${params.pattern}' in ${searchDir}`;
      } else {
        const lines = [...matchedFiles];
        if (isTruncated) {
          lines.push(
            `\n(Showing ${matchedFiles.length} of ${totalFound} matches. Consider using a more specific path or pattern.)`,
          );
        }
        outputText = lines.join('\n');
      }

      return this.success(
        outputText,
        {
          pattern: params.pattern,
          searchDir,
          files: matchedFiles,
          totalMatches: totalFound,
          isTruncated,
          durationMs,
        },
        {
          count: matchedFiles.length,
          total: totalFound,
          durationMs,
        },
      );
    } catch (err) {
      return this.error(`Glob search failed for pattern '${params.pattern}'`, err);
    }
  }
}
