/**
 * @file FileReadTool.ts
 * @description High-performance file reading tool with line numbering, offset/limit slicing,
 * binary protection, device file guards, and intelligent error diagnostics.
 */

import { existsSync, promises as fs } from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS } from '../../constants/index.js';

// ─── Constants & Device Guards ────────────────────────────────────────────────

const BLOCKED_DEVICE_PATHS = new Set([
  '/dev/zero',
  '/dev/random',
  '/dev/urandom',
  '/dev/full',
  '/dev/stdin',
  '/dev/tty',
  '/dev/console',
  '/dev/stdout',
  '/dev/stderr',
  '/dev/fd/0',
  '/dev/fd/1',
  '/dev/fd/2',
]);

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg',
  'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'xz', 'rar',
  'exe', 'dll', 'so', 'dylib', 'bin', 'obj', 'o', 'a', 'lib',
  'wasm', 'pyc', 'class', 'iso', 'dmg', 'mp3', 'mp4', 'mkv', 'avi', 'mov', 'wav'
]);

const DEFAULT_MAX_LINES = 2000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB safety cap

// ─── Input & Result Schemas ───────────────────────────────────────────────────

export const FileReadSchema = z.object({
  tagline: z
    .string()
    .describe(
      "A concise 2-5 word present-tense summary of what this specific tool call is doing, e.g. 'Reading src/main.ts', 'Searching for test fixtures'. Used for status logging."
    ),
  path: z.string().describe('The path to the file to read (relative or absolute).'),
  offset: z.number().int().min(1).optional().describe('1-based line number to start reading from (inclusive).'),
  limit: z.number().int().min(1).optional().describe('Maximum number of lines to read.'),
});

export type FileReadInput = z.infer<typeof FileReadSchema>;

export interface FileReadData {
  path: string;
  startLine: number;
  endLine: number;
  totalLines: number;
  isTruncated: boolean;
  content: string;
}

// ─── FileReadTool Implementation ──────────────────────────────────────────────

export class FileReadTool extends Tool<FileReadInput, FileReadData> {
  readonly name = 'read';
  readonly glyph = TOOL_GLYPHS.read;
  readonly description =
    'Read the contents of a text file from disk with 1-based line numbering. Supports offset and limit for large files.';
  readonly schema = FileReadSchema;
  override readonly isDangerous = false;

  private isBlockedDevice(targetPath: string): boolean {
    if (BLOCKED_DEVICE_PATHS.has(targetPath)) return true;
    if (
      targetPath.startsWith('/proc/') &&
      (targetPath.endsWith('/fd/0') || targetPath.endsWith('/fd/1') || targetPath.endsWith('/fd/2'))
    ) {
      return true;
    }
    return false;
  }

  private isBinaryFile(targetPath: string): boolean {
    const ext = path.extname(targetPath).toLowerCase().replace(/^\./, '');
    return BINARY_EXTENSIONS.has(ext);
  }

  private resolvePath(targetPath: string, cwd: string): string {
    const trimmed = targetPath.trim();
    if (trimmed.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.resolve(home, trimmed.slice(1).replace(/^[/\\]/, ''));
    }
    return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
  }

  private formatLineNumberedContent(lines: string[], startLine: number): string {
    const padWidth = String(startLine + lines.length).length;
    return lines
      .map((line, idx) => {
        const lineNum = String(startLine + idx).padStart(padWidth, ' ');
        return `${lineNum} | ${line}`;
      })
      .join('\n');
  }

  async execute(params: FileReadInput, context: ToolContext): Promise<ToolExecutionResult<FileReadData>> {
    const resolvedPath = this.resolvePath(params.path, context.cwd);

    if (this.isBlockedDevice(resolvedPath)) {
      return this.error(`Cannot read special device file '${params.path}' as it would block or produce infinite data.`);
    }

    if (this.isBinaryFile(resolvedPath)) {
      return this.error(
        `File '${params.path}' appears to be a binary file. Reading raw binary contents is not supported.`
      );
    }

    if (!existsSync(resolvedPath)) {
      return this.error(`File not found: '${params.path}' (resolved to '${resolvedPath}')`);
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (stat.isDirectory()) {
        return this.error(`Path '${params.path}' is a directory. Use 'glob' or shell commands to list directory contents.`);
      }

      if (stat.size > MAX_FILE_SIZE_BYTES && !params.offset && !params.limit) {
        return this.error(
          `File '${params.path}' is too large (${(stat.size / (1024 * 1024)).toFixed(2)} MB). Please specify offset and limit to read in chunks.`
        );
      }

      const rawContent = await fs.readFile(resolvedPath, 'utf8');
      const allLines = rawContent.split(/\r?\n/);
      const totalLines = allLines.length;

      const startLine = params.offset ? Math.max(1, params.offset) : 1;
      const effectiveLimit = params.limit ?? DEFAULT_MAX_LINES;
      const startIndex = startLine - 1;
      const endIndex = Math.min(totalLines, startIndex + effectiveLimit);

      if (startIndex >= totalLines && totalLines > 0) {
        return this.error(
          `Offset ${startLine} is beyond the total line count of the file (${totalLines} lines).`
        );
      }

      const selectedLines = allLines.slice(startIndex, endIndex);
      const isTruncated = endIndex < totalLines;

      const formatted = this.formatLineNumberedContent(selectedLines, startLine);
      const displayPath = path.relative(context.cwd, resolvedPath) || resolvedPath;

      return this.success(
        formatted,
        {
          path: resolvedPath,
          startLine,
          endLine: endIndex,
          totalLines,
          isTruncated,
          content: rawContent,
        },
        {
          totalLines,
          linesReturned: selectedLines.length,
          isTruncated,
        }
      );
    } catch (err) {
      return this.error(`Failed to read file '${params.path}'`, err);
    }
  }
}
