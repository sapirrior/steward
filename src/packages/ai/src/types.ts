/**
 * @steward/ai - Canonical AI Domain Contracts
 *
 * All types are additive-only where marked optional — old sessions without
 * the new fields still load and replay correctly.
 */

import type { AIError } from './errors.js';

// ─── Provider & Protocol identifiers ────────────────────────────────────────

/** Built-in provider ids. ProviderId is open — custom providers register at runtime. */
export type BuiltinProviderId =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'github-copilot'
  | 'openrouter';

export type ProviderId = BuiltinProviderId | (string & {});

export type ProtocolId =
  | 'anthropic-messages'
  | 'openai-completions'
  | 'openai-responses'
  | 'google-generative-ai';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

// ─── JSON primitives ─────────────────────────────────────────────────────────

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/**
 * JSON Schema is represented structurally (not via Zod or typebox).
 */
export type JsonSchema = Record<string, unknown>;

// ─── Message content blocks ───────────────────────────────────────────────────

export interface TextContent {
  type: 'text';
  text: string;
  textSignature?: string;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
  thinkingSignature?: string;
  redacted?: boolean;
}

export interface ToolCallContent {
  type: 'tool-call';
  id: string;
  name: string;
  arguments: JsonObject;
  thoughtSignature?: string;
}

export type AssistantContent = TextContent | ThinkingContent | ToolCallContent;

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | readonly TextContent[];
}

export interface ToolResultContent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: JsonValue;
  isError?: boolean;
}

export interface ToolMessage {
  role: 'tool';
  content: readonly ToolResultContent[];
}

/**
 * Metadata attached to an AssistantMessage after a completed inference.
 * Optional so old persisted sessions (without meta) still load.
 */
export interface AssistantMeta {
  provider: ProviderId;
  protocol: ProtocolId;
  modelId: string;
  usage?: TokenUsage;
  finishReason?: FinishReason;
  responseId?: string;
  rawStopReason?: string;
  timestamp?: number;
}

export interface AssistantMessage {
  role: 'assistant';
  content: readonly AssistantContent[];
  /** Optional — present after a live inference; absent in loaded/replayed sessions is OK. */
  meta?: AssistantMeta;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ─── Tool spec ────────────────────────────────────────────────────────────────

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

// ─── Token usage & cost ───────────────────────────────────────────────────────

export interface TokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  /** USD cost breakdown, present when model has pricing data. */
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export type FinishReason = 'stop' | 'length' | 'tool-use' | 'error' | 'aborted';

// ─── Model ────────────────────────────────────────────────────────────────────

/** Per-protocol compatibility flags. Added only when a test or provider needs one. */
export interface ProtocolCompat {
  // Anthropic
  forceAdaptiveThinking?: boolean;
  supportsTemperature?: boolean;
  supportsLongCacheRetention?: boolean;
  // OpenAI Completions
  maxTokensField?: 'max_tokens' | 'max_completion_tokens';
  supportsDeveloperRole?: boolean;
  supportsReasoningEffort?: boolean;
  supportsUsageInStreaming?: boolean;
  requiresToolResultName?: boolean;
  requiresAssistantAfterToolResult?: boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: ProviderId;
  protocol: ProtocolId;
  baseUrl: string;
  reasoning: boolean;
  /**
   * Per-effort thinking level map. Missing key = provider default; null = unsupported.
   * Values are strings (e.g. effort strings) or numbers (budget tokens).
   */
  thinkingLevelMap?: Partial<Record<ReasoningEffort, string | number | null>>;
  contextWindow?: number;
  maxOutputTokens: number;
  /** Per-million-token USD pricing. */
  cost?: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  /** Additional headers to send with every request to this model. */
  headers?: Record<string, string>;
  compat?: ProtocolCompat;
  /** Whether this model is the default for its provider. */
  default?: boolean;
}

// ─── Model selection ──────────────────────────────────────────────────────────

export interface ModelSelection {
  provider: ProviderId;
  modelId: string;
  effort: ReasoningEffort;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  provider: ProviderId;
  reasoning?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
}

// ─── Inference request / stream / result ──────────────────────────────────────

export interface InferenceRequest {
  model: ModelSelection;
  messages: readonly Message[];
  tools?: readonly ToolSpec[];
  temperature?: number;
  maxTokens?: number;
  sessionId?: string;
  cacheRetention?: 'none' | 'short' | 'long';
  /** Extra headers forwarded to the provider. */
  headers?: Record<string, string>;
  abortSignal?: AbortSignal;
}

export type InferenceEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'done'; message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason }
  | { type: 'error'; error: AIError; partial?: AssistantMessage };

/**
 * The result of a completed (or aborted/errored) inference.
 * result() NEVER rejects — errors surface as finishReason:'error' + error field.
 */
export interface InferenceResult {
  message: AssistantMessage;
  usage: TokenUsage;
  finishReason: FinishReason;
  error?: AIError;
}

export interface InferenceStream extends AsyncIterable<InferenceEvent> {
  /** Never rejects. On abort: finishReason 'aborted'. On error: finishReason 'error'. */
  result(): Promise<InferenceResult>;
}
