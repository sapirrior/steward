import {
  ThreadStore,
  type ThreadDocument,
  type ThreadSummary,
  type ThreadModelMeta,
  type ModelMessage,
  type ThreadUsage,
} from '@steward/threads';
import { normalizeModelMessages } from './messageNormalizer.js';

export interface ThreadControllerOptions {
  store?: ThreadStore;
  defaultModel: ThreadModelMeta;
  cwd?: string;
}

/**
 * High-level lifecycle coordinator for Steward conversation threads.
 * Manages thread creation, switching, persistence, and loading, ensuring
 * that the active ThreadDocument is the single source of truth.
 */
export class ThreadController {
  private readonly store: ThreadStore;
  private activeThread: ThreadDocument | null = null;
  private readonly defaultModel: ThreadModelMeta;
  private readonly defaultCwd: string;

  constructor(options: ThreadControllerOptions) {
    this.store = options.store ?? new ThreadStore();
    this.defaultModel = options.defaultModel;
    this.defaultCwd = options.cwd ?? process.cwd();
  }

  /**
   * Returns the currently active thread, or creates a new one if none is active.
   */
  getActiveThread(): ThreadDocument {
    if (!this.activeThread) {
      this.activeThread = this.createNewThread();
    }
    return this.activeThread;
  }

  /**
   * Instantiates a new thread document without immediately writing to disk.
   */
  createNewThread(customModel?: ThreadModelMeta): ThreadDocument {
    this.activeThread = this.store.create({
      model: customModel ?? this.defaultModel,
      cwd: this.defaultCwd,
      messages: [],
    });
    return this.activeThread;
  }

  /**
   * Atomically saves the active thread to disk.
   */
  async saveActiveThread(): Promise<void> {
    if (!this.activeThread) return;
    // Ensure all messages are in canonical normalized shape before saving
    this.activeThread.messages = normalizeModelMessages(this.activeThread.messages);
    await this.store.save(this.activeThread);
  }

  /**
   * Appends completed turn messages and updates accumulated token usage on the active thread.
   */
  async recordTurn(options: {
    userPrompt: string;
    responseMessages: ModelMessage[];
    usageDelta?: Partial<ThreadUsage>;
  }): Promise<void> {
    const thread = this.getActiveThread();

    // 1. Add user message
    thread.messages.push({
      role: 'user',
      content: options.userPrompt,
    });

    // 2. Add normalized assistant/tool response messages
    const normalizedResponses = normalizeModelMessages(options.responseMessages);
    thread.messages.push(...normalizedResponses);

    // 3. Accumulate token usage
    if (options.usageDelta) {
      thread.usage.inputTokens += options.usageDelta.inputTokens ?? 0;
      thread.usage.outputTokens += options.usageDelta.outputTokens ?? 0;
      thread.usage.totalTokens += options.usageDelta.totalTokens ?? 0;
      if (options.usageDelta.reasoningTokens) {
        thread.usage.reasoningTokens =
          (thread.usage.reasoningTokens ?? 0) + options.usageDelta.reasoningTokens;
      }
      if (options.usageDelta.cacheReadTokens) {
        thread.usage.cacheReadTokens =
          (thread.usage.cacheReadTokens ?? 0) + options.usageDelta.cacheReadTokens;
      }
      if (options.usageDelta.cacheWriteTokens) {
        thread.usage.cacheWriteTokens =
          (thread.usage.cacheWriteTokens ?? 0) + options.usageDelta.cacheWriteTokens;
      }
    }

    // 4. Persist to disk atomically
    await this.saveActiveThread();
  }

  /**
   * Loads a thread from disk by ID and sets it as the active thread.
   * Throws if thread cannot be found or loaded.
   */
  async loadThread(id: string): Promise<ThreadDocument> {
    const doc = await this.store.load(id);
    if (!doc) {
      throw new Error(`Thread not found: "${id}"`);
    }
    // Normalize messages on load to ensure valid shapes
    doc.messages = normalizeModelMessages(doc.messages);
    this.activeThread = doc;
    return doc;
  }

  /**
   * Resumes the latest saved thread, or creates a new one if no saved threads exist.
   */
  async resumeLatest(): Promise<ThreadDocument | null> {
    const latest = await this.store.getLatest();
    if (latest) {
      latest.messages = normalizeModelMessages(latest.messages);
      this.activeThread = latest;
      return latest;
    }
    return null;
  }

  /**
   * Lists stored threads ordered by newest first.
   */
  async listThreads(limit?: number): Promise<ThreadSummary[]> {
    const summaries = await this.store.list();
    if (typeof limit === 'number' && limit > 0) {
      return summaries.slice(0, limit);
    }
    return summaries;
  }

  /**
   * Updates active thread metadata (e.g. model or reasoning effort).
   */
  async updateModel(model: ThreadModelMeta): Promise<void> {
    const thread = this.getActiveThread();
    thread.model = model;
    await this.saveActiveThread();
  }
}
