import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, open, rename } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { ThreadStorageError } from './threadErrors.js';
import { generateThreadId } from './generateId.js';
import { generateThreadTitle } from './generateTitle.js';
import type {
  CreateThreadOptions,
  ThreadDocument,
  ThreadStoreOptions,
  ThreadSummary,
  ThreadUsage,
} from './threadTypes.js';

export const DEFAULT_STEWARD_THREADS_DIR = path.join(os.homedir(), '.steward', 'threads');

function createEmptyUsage(): ThreadUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
}

export class ThreadStore {
  private readonly baseDir: string;
  private isDirInitialized = false;
  private readonly mutationLocks = new Map<string, Promise<unknown>>();

  constructor(options?: ThreadStoreOptions) {
    this.baseDir =
      options?.baseDir ?? process.env.STEWARD_THREADS_DIR ?? DEFAULT_STEWARD_THREADS_DIR;
  }

  /**
   * Resolves the target file path while strictly neutralizing path traversal attacks.
   */
  getThreadPath(id: string): string {
    const sanitizedId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.baseDir, `${sanitizedId}.json`);
  }

  /**
   * Idempotently ensures the storage directory exists with 0o700 permissions.
   */
  private async ensureDir(): Promise<void> {
    if (this.isDirInitialized) return;
    try {
      await mkdir(this.baseDir, { recursive: true, mode: 0o700 });
      this.isDirInitialized = true;
    } catch (err: unknown) {
      throw new ThreadStorageError(
        `Failed to create threads directory at "${this.baseDir}"`,
        'DIR_CREATE_FAILED',
        err,
      );
    }
  }

  /**
   * Instantiates an in-memory ThreadDocument with default metadata, timestamps, and usage.
   */
  create(options: CreateThreadOptions): ThreadDocument {
    const createdAt = new Date().toISOString();
    const id = options.id ?? generateThreadId({ cwd: options.cwd, createdAt });
    const cwd = options.cwd ?? process.cwd();

    const title = options.title
      ? options.title
      : options.messages && options.messages.length > 0
        ? this.deriveTitleFromMessages(options.messages)
        : 'New Thread';

    const usage: ThreadUsage = {
      inputTokens: options.usage?.inputTokens ?? 0,
      outputTokens: options.usage?.outputTokens ?? 0,
      totalTokens:
        options.usage?.totalTokens ??
        (options.usage?.inputTokens ?? 0) + (options.usage?.outputTokens ?? 0),
      reasoningTokens: options.usage?.reasoningTokens,
      cacheReadTokens: options.usage?.cacheReadTokens,
      cacheWriteTokens: options.usage?.cacheWriteTokens,
    };

    return {
      version: 1,
      id,
      title,
      createdAt,
      updatedAt: createdAt,
      model: options.model,
      metadata: {
        cwd,
        git: options.git,
        environment: options.environment ?? {
          platform: process.platform,
          arch: process.arch,
        },
        custom: options.custom ?? {},
      },
      usage,
      messages: options.messages ?? [],
    };
  }

  /**
   * Loads and parses a full ThreadDocument by ID from disk.
   * Returns null if the thread does not exist.
   */
  async load(id: string): Promise<ThreadDocument | null> {
    const filePath = this.getThreadPath(id);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const raw = await readFile(filePath, 'utf-8');
      if (!raw.trim()) {
        return null;
      }

      const data = JSON.parse(raw);
      if (
        !data ||
        typeof data !== 'object' ||
        (data.version !== undefined && data.version !== 1) ||
        !Array.isArray(data.messages) ||
        typeof data.id !== 'string'
      ) {
        throw new ThreadStorageError(`Invalid thread structure in "${filePath}"`, 'INVALID_DATA');
      }

      if (typeof data.model === 'string') {
        data.model = { provider: 'unknown', modelId: data.model };
      } else if (!data.model) {
        data.model = { provider: 'unknown', modelId: 'unknown' };
      }
      if (!data.version) {
        data.version = 1;
      }
      if (!data.usage) {
        data.usage = createEmptyUsage();
      }

      return data as ThreadDocument;
    } catch (err: unknown) {
      if (err instanceof ThreadStorageError) {
        throw err;
      }
      throw new ThreadStorageError(
        `Failed to load thread "${id}" from "${filePath}"`,
        'LOAD_FAILED',
        err,
      );
    }
  }

  /**
   * Atomically writes a ThreadDocument to disk.
   * Employs temp file + 0o600 mode + fsync + atomic rename with Windows lock backoff.
   */
  async save(thread: ThreadDocument): Promise<void> {
    await this.ensureDir();

    // Auto-update title if generic and messages now exist
    if (thread.title === 'New Thread' && thread.messages.length > 0) {
      thread.title = this.deriveTitleFromMessages(thread.messages);
    }

    thread.updatedAt = new Date().toISOString();

    const targetPath = this.getThreadPath(thread.id);
    const tempFileName = `.tmp.${thread.id}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.json`;
    const tempPath = path.join(this.baseDir, tempFileName);

    const serialized = JSON.stringify(thread, null, 2);

    try {
      const handle = await open(tempPath, 'w', 0o600);
      try {
        await handle.writeFile(serialized, 'utf-8');
        await handle.sync();
      } finally {
        await handle.close();
      }

      // Windows EPERM / EBUSY rename retry loop with backoff
      let attempts = 0;
      const maxAttempts = 5;
      let delayMs = 20;

      while (true) {
        try {
          await rename(tempPath, targetPath);
          break;
        } catch (err: unknown) {
          const code = (err as { code?: string })?.code;
          if (
            (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES') &&
            attempts < maxAttempts
          ) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
            delayMs *= 2;
            continue;
          }
          throw err;
        }
      }
    } catch (err: unknown) {
      try {
        if (existsSync(tempPath)) {
          await unlink(tempPath);
        }
      } catch {
        // Silently ignore temp file cleanup failures
      }

      throw new ThreadStorageError(
        `Failed to atomically save thread "${thread.id}"`,
        'SAVE_FAILED',
        err,
      );
    }
  }

  /**
   * Serializes mutations to a specific thread ID to prevent race conditions.
   * Atomically loads, executes updater callback, and saves the updated document.
   */
  async mutate(
    id: string,
    updater: (thread: ThreadDocument) => void | Promise<void>,
  ): Promise<ThreadDocument> {
    const previousLock = this.mutationLocks.get(id) ?? Promise.resolve();

    let resolveCurrentLock!: () => void;
    const currentLock = new Promise<void>((resolve) => {
      resolveCurrentLock = resolve;
    });

    this.mutationLocks.set(id, currentLock);

    try {
      await previousLock;

      const thread = await this.load(id);
      if (!thread) {
        throw new ThreadStorageError(`Thread "${id}" not found for mutation`, 'NOT_FOUND');
      }

      await updater(thread);
      await this.save(thread);

      return thread;
    } finally {
      resolveCurrentLock();
      if (this.mutationLocks.get(id) === currentLock) {
        this.mutationLocks.delete(id);
      }
    }
  }

  /**
   * Lists lightweight summaries of all stored threads, sorted by updatedAt DESC.
   * Corrupted or temporary files are ignored safely without aborting.
   */
  async list(): Promise<ThreadSummary[]> {
    await this.ensureDir();

    let entries: string[] = [];
    try {
      entries = await readdir(this.baseDir);
    } catch {
      return [];
    }

    const summaries: ThreadSummary[] = [];

    for (const entry of entries) {
      if (!entry.endsWith('.json') || entry.startsWith('.')) {
        continue;
      }

      const filePath = path.join(this.baseDir, entry);
      try {
        const raw = await readFile(filePath, 'utf-8');
        if (!raw.trim()) continue;

        const data = JSON.parse(raw);
        if (
          data &&
          typeof data === 'object' &&
          (data.version === 1 || data.version === undefined) &&
          typeof data.id === 'string' &&
          Array.isArray(data.messages)
        ) {
          const model =
            typeof data.model === 'string'
              ? { provider: 'unknown', modelId: data.model }
              : (data.model ?? { provider: 'unknown', modelId: 'unknown' });

          summaries.push({
            id: data.id,
            title: data.title ?? 'New Thread',
            createdAt: data.createdAt ?? new Date().toISOString(),
            updatedAt: data.updatedAt ?? data.createdAt ?? new Date().toISOString(),
            model,
            cwd: data.metadata?.cwd ?? data.cwd ?? process.cwd(),
            gitBranch: data.metadata?.git?.branch,
            messageCount: data.messages.length,
            usage: data.usage ?? createEmptyUsage(),
          });
        }
      } catch {
        // Skip unparseable files without crashing
      }
    }

    return summaries.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }

  /**
   * Retrieves the most recently modified thread from disk (used by --continue).
   */
  async getLatest(): Promise<ThreadDocument | null> {
    const summaries = await this.list();
    if (summaries.length === 0) {
      return null;
    }

    const latest = summaries[0];
    if (!latest) {
      return null;
    }

    return this.load(latest.id);
  }

  /**
   * Deletes a thread from disk. Returns true if removed, false if not found.
   */
  async delete(id: string): Promise<boolean> {
    const filePath = this.getThreadPath(id);
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      await unlink(filePath);
      return true;
    } catch (err: unknown) {
      throw new ThreadStorageError(`Failed to delete thread "${id}"`, 'DELETE_FAILED', err);
    }
  }

  /**
   * Helper extracting a title preview from an array of messages.
   */
  private deriveTitleFromMessages(messages: ThreadDocument['messages']): string {
    const firstUser = messages.find((m) => m.role === 'user');
    if (!firstUser) {
      return 'New Thread';
    }

    if (typeof firstUser.content === 'string') {
      return generateThreadTitle(firstUser.content);
    }

    if (Array.isArray(firstUser.content)) {
      const textPart = firstUser.content.find((part) => part.type === 'text');
      if (textPart && 'text' in textPart && typeof textPart.text === 'string') {
        return generateThreadTitle(textPart.text);
      }
    }

    return 'New Thread';
  }
}

export const threadStore = new ThreadStore();
