import { realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

/**
 * Normalizes a folder path for consistent trust lookups and storage.
 * Resolves symlinks, strips trailing separators, and adjusts case for case-insensitive OSes.
 */
export function normalizeFolderPath(inputPath: string): string {
  let absolute = resolve(inputPath);
  try {
    absolute = realpathSync(absolute);
  } catch {
    // Fall back to resolved absolute path if realpathSync throws
  }

  // Strip trailing path separator unless it is root (e.g. "/" or "C:\")
  if (absolute.length > 1 && absolute.endsWith(sep)) {
    absolute = absolute.slice(0, -1);
  }

  // Lowercase for darwin / win32 to handle case-insensitive filesystem matching
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return absolute.toLowerCase();
  }

  return absolute;
}
