/**
 * @steward/agent - Model Port
 *
 * Agent-owned interface definitions for the model client and all associated
 * types the agent loop depends on. No import from @steward/ai — cli wires the
 * concrete implementation at composition time.
 *
 * cli enforces structural compatibility: `const _: ModelPort = ai` in
 * cli/src/runtime.ts fails typecheck if the shapes ever diverge.
 */

// ─── Primitive aliases ────────────────────────────────────────────────────────

export type ProviderId = string;
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export type JsonSchema = Record<string, unknown>;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

// ─── Message types ────────────────────────────────────────────────────────────

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
  arguments: Record<string, unknown>;
  thoughtSignature?: string;
}

export type AssistantContent = TextContent | ThinkingContent | ToolCallContent;

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

export interface AssistantMessage {
  role: 'assistant';
  content: readonly AssistantContent[];
  meta?: Record<string, unknown>;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

// ─── Tool spec ────────────────────────────────────────────────────────────────

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

// ─── Token usage ──────────────────────────────────────────────────────────────

export interface TokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  total?: number;
  cost?: { input: number; output: number; cacheRead?: number; cacheWrite?: number; total: number };
}

// ─── Model selection ──────────────────────────────────────────────────────────

export interface ModelSelection {
  provider: ProviderId;
  modelId: string;
  effort: ReasoningEffort;
}

// ─── Stream events ────────────────────────────────────────────────────────────

export type PortEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'done'; message: AssistantMessage; usage: TokenUsage; finishReason: string }
  | { type: 'error'; error: PortError; partial?: AssistantMessage };

/** Structured error surfaced through the stream. */
export interface PortError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  providerType?: string;
  provider?: string;
}

/** Result of a completed (or errored/aborted) stream. Never rejects. */
export interface PortResult {
  message: AssistantMessage;
  usage: TokenUsage;
  finishReason: string;
  error?: PortError;
}

/** Async-iterable stream of inference events plus a result() promise. */
export interface PortStream extends AsyncIterable<PortEvent> {
  result(): Promise<PortResult>;
}

// ─── Model port ───────────────────────────────────────────────────────────────

/** Minimal inference request — only what the agent loop actually passes. */
export interface PortRequest {
  model: ModelSelection;
  effort?: ReasoningEffort;
  messages: readonly Message[];
  tools?: readonly ToolSpec[];
  temperature?: number;
  abortSignal?: AbortSignal;
}

/**
 * The only surface agent needs from the AI client.
 * cli satisfies this structurally with the concrete @steward/ai AI object.
 */
export interface ModelPort {
  stream(request: PortRequest): PortStream;
}
