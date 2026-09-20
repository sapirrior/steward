import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { ToolDefinition } from '../types.js';

export const readFileInputSchema = z.object({
  path: z
    .string()
    .describe('The path of the file to read (relative to current working directory or absolute).'),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('The line number to start reading from (1-indexed). Defaults to 1.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(2000)
    .optional()
    .describe('The maximum number of lines to read. Defaults to 200.'),
});

export type ReadFileInput = z.infer<typeof readFileInputSchema>;

export interface ReadFileOutput {
  path: string;
  totalLines: number;
  startLine: number;
  endLine: number;
  content: string;
  isTruncated: boolean;
  linesRead: number;
}

/**
 * Checks if a given path is inside (or equal to) the base directory.
 */
function isPathInside(targetPath: string, basePath: string): boolean {
  const normTarget = resolve(targetPath);
  const normBase = resolve(basePath);

  if (normTarget === normBase) {
    return true;
  }

  const prefix = normBase.endsWith(sep) ? normBase : `${normBase}${sep}`;
  return normTarget.startsWith(prefix);
}

/**
 * Validates and confines read paths within the workspace root.
 */
function resolveSafeReadPath(cwd: string, filePath: string): string {
  if (!filePath || !filePath.trim()) {
    throw new Error('File path cannot be empty.');
  }

  const trimmed = filePath.trim();
  const resolved = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed);

  if (!isPathInside(resolved, cwd)) {
    throw new Error(
      `Access denied: path "${filePath}" resolves outside the trusted workspace root ("${cwd}").`,
    );
  }

  if (!existsSync(resolved)) {
    throw new Error(`File not found: ${filePath}`);
  }

  let realTarget: string;
  try {
    realTarget = realpathSync(resolved);
  } catch {
    realTarget = resolved;
  }

  if (!isPathInside(realTarget, cwd)) {
    throw new Error(
      `Access denied: symlink "${filePath}" points outside the trusted workspace root.`,
    );
  }

  const stat = lstatSync(resolved);
  if (stat.isDirectory()) {
    throw new Error(`Cannot read path because it is a directory: ${filePath}`);
  }

  if (!stat.isFile() && !stat.isSymbolicLink()) {
    throw new Error(`Cannot read special or non-regular file: ${filePath}`);
  }

  return realTarget;
}

/**
 * Checks if a buffer appears to be binary by checking for null bytes.
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 1024);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

export const readFileTool: ToolDefinition<typeof readFileInputSchema, ReadFileOutput> = {
  name: 'read_file',
  displayName: 'Read',
  description:
    'Reads the contents of a file. Supports reading specific line ranges via offset and limit. Read is read-only and does not mutate or checkpoint.',
  parameters: readFileInputSchema,
  confirmationPolicy: 'never',

  summarize: (_args, result) => {
    const lines = result?.linesRead ?? 0;
    return `Read ${lines} line${lines === 1 ? '' : 's'}`;
  },

  execute: async (args, context) => {
    const targetPath = resolveSafeReadPath(context.cwd, args.path);

    const stat = lstatSync(targetPath);
    if (stat.isDirectory()) {
      throw new Error(`Cannot read path because it is a directory: ${args.path}`);
    }

    const buffer = readFileSync(targetPath);
    if (isBinaryBuffer(buffer)) {
      return {
        path: args.path,
        totalLines: 0,
        startLine: 0,
        endLine: 0,
        content: `[Binary file: size ${buffer.length} bytes]`,
        isTruncated: false,
        linesRead: 0,
      };
    }

    const text = buffer.toString('utf-8');
    if (text.length === 0) {
      return {
        path: args.path,
        totalLines: 0,
        startLine: 0,
        endLine: 0,
        content: '',
        isTruncated: false,
        linesRead: 0,
      };
    }

    const allLines = text.split(/\r?\n/);
    const totalLines = allLines.length;

    const startLine = args.offset ?? 1;
    const limit = args.limit ?? 200;
    const startIndex = Math.max(0, startLine - 1);
    const endIndex = Math.min(totalLines, startIndex + limit);

    const slice = allLines.slice(startIndex, endIndex);

    return {
      path: args.path,
      totalLines,
      startLine,
      endLine: endIndex,
      content: slice.join('\n'),
      isTruncated: endIndex < totalLines,
      linesRead: slice.length,
    };
  },
};
