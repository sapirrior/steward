import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export interface AtomicWriteOptions {
  mode?: number;
  encoding?: BufferEncoding;
}

/**
 * Safely and atomically writes content to targetPath using a temp-file, fsync, and atomic rename strategy.
 */
export function atomicWriteFileSync(
  targetPath: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {},
): void {
  const buffer =
    typeof content === 'string' ? Buffer.from(content, options.encoding ?? 'utf-8') : content;
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const mode = options.mode ?? 0o644;
  const tmpPath = join(dir, `.tmp-write-${randomUUID().slice(0, 8)}`);

  let fd: number | null = null;
  try {
    fd = openSync(tmpPath, 'w', mode);
    writeSync(fd, buffer, 0, buffer.length);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;

    try {
      chmodSync(tmpPath, mode);
    } catch {
      // Best-effort permission preservation
    }

    renameSync(tmpPath, targetPath);
  } catch (err) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {}
    }
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath);
      } catch {}
    }
    throw err;
  }
}
