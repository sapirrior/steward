/**
 * AI SDK v7 Core Model Message contract (agnostic & verbatim).
 * Preserves the exact turn history produced by model inference and tools.
 */
export type ModelMessage =
  SystemModelMessage | UserModelMessage | AssistantModelMessage | ToolModelMessage;

export interface SystemModelMessage {
  role: 'system';
  content: string;
}

export type UserContentPart =
  { type: 'text'; text: string } | { type: 'file'; mediaType: string; data: string | URL };

export interface UserModelMessage {
  role: 'user';
  content: string | UserContentPart[];
}

export type AssistantContentPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string; signature?: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown };

export interface AssistantModelMessage {
  role: 'assistant';
  content: string | AssistantContentPart[];
}

export interface ToolContentPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export interface ToolModelMessage {
  role: 'tool';
  content: ToolContentPart[];
}

/**
 * Pure token counts accumulated across conversation turns.
 */
export interface ThreadUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/**
 * Active model metadata attached to the thread.
 */
export interface ThreadModelMeta {
  provider: string;
  modelId: string;
  reasoning?: 'none' | 'low' | 'medium' | 'high' | string;
}

/**
 * Git repository state captured when starting or updating the thread.
 */
export interface ThreadGitMeta {
  branch?: string;
  commit?: string;
  remote?: string;
}

/**
 * System and platform environment information.
 */
export interface ThreadEnvMeta {
  stewardVersion?: string;
  platform?: string;
  arch?: string;
}

/**
 * Contextual metadata about the session workspace.
 */
export interface ThreadMetadata {
  cwd: string;
  git?: ThreadGitMeta;
  environment?: ThreadEnvMeta;
  custom?: Record<string, unknown>;
}

/**
 * Complete persistent thread entity (~/.steward/threads/th_<id>.json).
 */
export interface ThreadDocument {
  version: 1;
  id: string; // e.g. "th_7a8f3b92c4e1d09a"
  title: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  model: ThreadModelMeta;
  metadata: ThreadMetadata;
  usage: ThreadUsage;
  messages: ModelMessage[];
}

/**
 * Lightweight summary returned by .list() for fast dialog pickers.
 */
export interface ThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: ThreadModelMeta;
  cwd: string;
  gitBranch?: string;
  messageCount: number;
  usage: ThreadUsage;
}

/**
 * Options for instantiating a new ThreadDocument.
 */
export interface CreateThreadOptions {
  id?: string;
  title?: string;
  model: ThreadModelMeta;
  cwd?: string;
  git?: ThreadGitMeta;
  environment?: ThreadEnvMeta;
  custom?: Record<string, unknown>;
  messages?: ModelMessage[];
  usage?: Partial<ThreadUsage>;
}

/**
 * Options for initializing the ThreadStore.
 */
export interface ThreadStoreOptions {
  baseDir?: string;
}
