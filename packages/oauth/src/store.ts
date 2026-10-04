import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, chmodSync, readFileSync, unlinkSync } from 'node:fs';
import { open, rename, unlink, chmod } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import type { AuthStoreData, TokenRecord } from './types.js';

export const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_INTERVAL_MS = 25;

/**
 * Custom error class ensuring credentials are never leaked in error logs.
 */
export class AuthStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AuthStorageError';
  }
}

/**
 * Resolves the path to the auth storage file.
 * Defaults to ~/.steward/auth.json, configurable via STEWARD_AUTH_FILE.
 */
export function getAuthFilePath(): string {
  if (process.env.STEWARD_AUTH_FILE) {
    return process.env.STEWARD_AUTH_FILE;
  }
  const dir = process.env.STEWARD_AUTH_DIR || join(homedir(), '.steward');
  return join(dir, 'auth.json');
}

/**
 * Resolves the directory containing the auth storage file.
 */
export function getAuthDir(): string {
  return dirname(getAuthFilePath());
}

/**
 * Resolves the path to the lock file for cross-process synchronization.
 */
function getAuthLockPath(): string {
  return `${getAuthFilePath()}.lock`;
}

/**
 * Sets directory and file permissions safely (no-op/safe on filesystems without POSIX mode support).
 */
export function safeChmod(targetPath: string, mode: number): void {
  try {
    chmodSync(targetPath, mode);
  } catch {
    // Ignore permission errors on non-POSIX/emulated filesystems
  }
}

export async function safeChmodAsync(targetPath: string, mode: number): Promise<void> {
  try {
    await chmod(targetPath, mode);
  } catch {
    // Ignore permission errors on non-POSIX/emulated filesystems
  }
}

/**
 * Ensures the auth directory exists with owner-only (0o700) permissions.
 */
export async function ensureAuthDir(): Promise<string> {
  const dir = getAuthDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: DIR_MODE });
  }
  safeChmod(dir, DIR_MODE);
  return dir;
}

// In-process mutex to serialize operations within the same process
let processLockQueue: Promise<void> = Promise.resolve();

function withInProcessLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = processLockQueue.then(async () => {
    return fn();
  });
  processLockQueue = next.then(
    () => {},
    () => {},
  );
  return next;
}

/**
 * Acquires a cross-process lock file using exclusive file creation ('wx').
 */
export async function acquireFileLock(): Promise<() => Promise<void>> {
  await ensureAuthDir();
  const lockPath = getAuthLockPath();
  const startTime = Date.now();

  while (true) {
    try {
      const handle = await open(lockPath, 'wx');
      // Lock acquired
      await handle.write(String(process.pid));
      await handle.close();
      break;
    } catch (err: any) {
      if (err.code === 'EEXIST') {
        // Check for stale lock
        const elapsed = Date.now() - startTime;
        if (elapsed > LOCK_TIMEOUT_MS) {
          try {
            await unlink(lockPath);
          } catch {
            // Ignored if already removed
          }
        }
        await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
      } else {
        throw new AuthStorageError('Failed to acquire auth storage lock', 'LOCK_ERROR', err);
      }
    }
  }

  return async () => {
    try {
      await unlink(lockPath);
    } catch {
      // Ignored if already released
    }
  };
}

/**
 * Reads the current auth store from disk.
 * Returns empty object if file does not exist.
 * Throws AuthStorageError if file is corrupted/malformed.
 */
export async function readAuthStore(): Promise<AuthStoreData> {
  const filePath = getAuthFilePath();
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
      return {};
    }
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Auth store content is not an object');
    }
    return data as AuthStoreData;
  } catch (err: any) {
    if (err instanceof AuthStorageError) throw err;
    throw new AuthStorageError(
      'Auth storage file is corrupted or malformed',
      'CORRUPTED_AUTH_FILE',
      err,
    );
  }
}

/**
 * Writes the auth store to disk atomically with owner-only (0o600) permissions.
 */
export async function writeAuthStore(data: AuthStoreData): Promise<void> {
  const dir = await ensureAuthDir();
  const filePath = getAuthFilePath();
  const tempPath = join(dir, `auth.tmp.${Date.now()}.${randomBytes(4).toString('hex')}`);

  const serialized = JSON.stringify(data, null, 2);

  try {
    const handle = await open(tempPath, 'w', FILE_MODE);
    await handle.writeFile(serialized, { encoding: 'utf-8' });
    await handle.sync();
    await handle.close();

    await safeChmodAsync(tempPath, FILE_MODE);

    // Cross-platform atomic rename with retry on Windows EPERM / EBUSY
    let renameAttempts = 0;
    const maxRenameAttempts = 5;
    let renameDelay = 25;

    while (true) {
      try {
        await rename(tempPath, filePath);
        break;
      } catch (err: any) {
        if (
          (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') &&
          renameAttempts < maxRenameAttempts
        ) {
          renameAttempts++;
          await new Promise((resolve) => setTimeout(resolve, renameDelay));
          renameDelay *= 2;
          continue;
        }
        throw err;
      }
    }

    await safeChmodAsync(filePath, FILE_MODE);
  } catch (err: any) {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // Ignore temp file cleanup error
    }
    throw new AuthStorageError('Failed to write auth storage atomically', 'WRITE_ERROR', err);
  }
}

/**
 * Executes a locked read-modify-write mutation on the auth store.
 */
export async function mutateAuthStore<T>(
  mutator: (
    data: AuthStoreData,
  ) => Promise<{ data: AuthStoreData; result: T }> | { data: AuthStoreData; result: T },
): Promise<T> {
  return withInProcessLock(async () => {
    const releaseLock = await acquireFileLock();
    try {
      const current = await readAuthStore();
      const { data: updated, result } = await mutator(current);
      await writeAuthStore(updated);
      return result;
    } finally {
      await releaseLock();
    }
  });
}

/**
 * Retrieves the stored credential record for a provider.
 */
export async function getStoredToken(provider: string): Promise<TokenRecord | null> {
  const data = await readAuthStore();
  return data[provider] ?? null;
}

/**
 * Stores or updates credentials for a provider.
 */
export async function saveStoredToken(provider: string, token: TokenRecord): Promise<void> {
  await mutateAuthStore((data) => {
    data[provider] = token;
    return { data, result: undefined };
  });
}

/**
 * Deletes credentials for a provider.
 */
export async function deleteStoredToken(provider: string): Promise<boolean> {
  return mutateAuthStore((data) => {
    if (provider in data) {
      delete data[provider];
      return { data, result: true };
    }
    return { data, result: false };
  });
}

/**
 * Deletes all credentials across all providers.
 */
export async function clearStoredTokens(): Promise<number> {
  return mutateAuthStore((data) => {
    const count = Object.keys(data).length;
    return { data: {}, result: count };
  });
}
