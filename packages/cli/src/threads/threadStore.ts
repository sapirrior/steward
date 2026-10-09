import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, open, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Message, TokenUsage } from '@steward/ai';
import { STEWARD_THREADS_DIR } from '../constants/index.js';
import type { Thread, ThreadMeta } from './threadTypes.js';

export class ThreadStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ThreadStorageError';
  }
}

export interface CreateThreadOptions {
  id?: string;
  title?: string;
  model: string;
  cwd?: string;
  gitBranch?: string;
  messages?: Message[];
}

export class ThreadStore {
  private baseDir: string;
  private isInitialized = false;

  constructor(baseDir: string = STEWARD_THREADS_DIR) {
    this.baseDir = baseDir;
  }

  /**
   * Generates a unique, sortable thread ID.
   */
  generateId(): string {
    const timePart = Date.now().toString(36);
    const randPart = crypto.randomBytes(4).toString('hex');
    return `th_${timePart}${randPart}`;
  }

  /**
   * Generates a concise title from the initial user prompt.
   */
  generateTitle(prompt: string): string {
    const cleaned = prompt.replace(/\s+/g, ' ').trim();
    if (!cleaned) return 'New Thread';
    if (cleaned.length <= 48) return cleaned;
    const truncated = cleaned.slice(0, 48);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 24) {
      return `${truncated.slice(0, lastSpace)}...`;
    }
    return `${truncated}...`;
  }

  /**
   * Resolves the absolute path for a thread file.
   */
  getThreadPath(id: string): string {
    const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(this.baseDir, `${safeId}.json`);
  }

  /**
   * Ensures the threads storage directory exists.
   */
  private async ensureDir(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await mkdir(this.baseDir, { recursive: true });
      this.isInitialized = true;
    } catch (err: any) {
      throw new ThreadStorageError(
        `Failed to create threads directory at ${this.baseDir}`,
        'DIR_CREATE_FAILED',
        err,
      );
    }
  }

  /**
   * Creates a new Thread object in memory.
   */
  create(options: CreateThreadOptions): Thread {
    const now = new Date().toISOString();
    const id = options.id ?? this.generateId();
    const title = options.title ?? 'New Thread';
    const cwd = options.cwd ?? process.cwd();

    return {
      version: 1,
      id,
      title,
      createdAt: now,
      updatedAt: now,
      model: options.model,
      cwd,
      gitBranch: options.gitBranch,
      messages: options.messages ?? [],
    };
  }

  /**
   * Atomically writes a Thread object to disk.
   * Handles Windows file-locking retry and ensures fsync before rename.
   */
  async save(thread: Thread): Promise<void> {
    await this.ensureDir();

    // Auto-update thread title if still generic and a user message exists
    if (thread.title === 'New Thread' && thread.messages.length > 0) {
      const firstUserMsg = thread.messages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        const textContent =
          typeof firstUserMsg.content === 'string'
            ? firstUserMsg.content
            : firstUserMsg.content
                .filter((p) => p.type === 'text')
                .map((p) => (p as any).text)
                .join(' ');
        if (textContent) {
          thread.title = this.generateTitle(textContent);
        }
      }
    }

    thread.updatedAt = new Date().toISOString();

    const finalPath = this.getThreadPath(thread.id);
    const tempPath = path.join(
      this.baseDir,
      `.tmp.${thread.id}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.json`,
    );

    const serialized = JSON.stringify(thread, null, 2);

    try {
      const handle = await open(tempPath, 'w', 0o600);
      try {
        await handle.writeFile(serialized, 'utf-8');
        await handle.sync();
      } finally {
        await handle.close();
      }

      // Windows EPERM / EBUSY atomic rename retry loop with backoff
      let attempts = 0;
      const maxAttempts = 5;
      let delay = 20;

      while (true) {
        try {
          await rename(tempPath, finalPath);
          break;
        } catch (err: any) {
          if (
            (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') &&
            attempts < maxAttempts
          ) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    } catch (err: any) {
      try {
        if (existsSync(tempPath)) {
          await unlink(tempPath);
        }
      } catch {}
      throw new ThreadStorageError(
        `Failed to atomically save thread "${thread.id}"`,
        'SAVE_FAILED',
        err,
      );
    }
  }

  /**
   * Loads a full thread by ID from disk.
   * Returns null if thread does not exist.
   */
  async load(id: string): Promise<Thread | null> {
    const filePath = this.getThreadPath(id);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const raw = await readFile(filePath, 'utf-8');
      if (!raw.trim()) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !Array.isArray(data.messages)) {
        throw new Error('Invalid thread JSON structure');
      }
      return data as Thread;
    } catch (err: any) {
      throw new ThreadStorageError(
        `Failed to load thread "${id}" from ${filePath}`,
        'LOAD_FAILED',
        err,
      );
    }
  }

  /**
   * Lists all thread metadata sorted by updatedAt descending.
   * Silently skips corrupt files and temporary files.
   */
  async list(): Promise<ThreadMeta[]> {
    await this.ensureDir();

    let files: string[] = [];
    try {
      files = await readdir(this.baseDir);
    } catch {
      return [];
    }

    const metas: ThreadMeta[] = [];

    for (const file of files) {
      if (!file.endsWith('.json') || file.startsWith('.')) {
        continue;
      }

      const filePath = path.join(this.baseDir, file);
      try {
        const raw = await readFile(filePath, 'utf-8');
        if (!raw.trim()) continue;
        const thread: Thread = JSON.parse(raw);

        if (thread && thread.id && Array.isArray(thread.messages)) {
          metas.push({
            id: thread.id,
            title: thread.title || 'Untitled Thread',
            createdAt: thread.createdAt || new Date().toISOString(),
            updatedAt: thread.updatedAt || thread.createdAt || new Date().toISOString(),
            model: thread.model || 'unknown',
            cwd: thread.cwd || process.cwd(),
            gitBranch: thread.gitBranch,
            messageCount: thread.messages.length,
            totalUsage: thread.totalUsage,
          });
        }
      } catch {
        // Skip unreadable or corrupted files without throwing
      }
    }

    // Sort by updatedAt descending (most recent first)
    return metas.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Retrieves the most recently updated thread for the --continue flag.
   */
  async getLatest(): Promise<Thread | null> {
    const list = await this.list();
    if (list.length === 0) return null;
    const latestMeta = list[0]!;
    return this.load(latestMeta.id);
  }

  /**
   * Deletes a thread by ID.
   */
  async delete(id: string): Promise<boolean> {
    const filePath = this.getThreadPath(id);
    if (!existsSync(filePath)) {
      return false;
    }
    try {
      await unlink(filePath);
      return true;
    } catch (err: any) {
      throw new ThreadStorageError(
        `Failed to delete thread "${id}"`,
        'DELETE_FAILED',
        err,
      );
    }
  }
}

export const threadStore = new ThreadStore();
