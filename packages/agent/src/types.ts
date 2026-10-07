/**
 * @steward/agent - Generic Agent Types & Contracts
 *
 * Zero-dependency, pure domain types for message history, tool specifications,
 * stream requests, model stream interfaces, and loop execution results.
 */

// ─── Primitive Aliases ────────────────────────────────────────────────────────

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export type JsonSchema = Record<string, unknown>;
export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

// ─── Message Parts & Content ──────────────────────────────────────────────────

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

// ─── Tool Specifications ──────────────────────────────────────────────────────

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface ToolResult {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  isError: boolean;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
}

// ─── Token Usage Metrics ──────────────────────────────────────────────────────

export interface TokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  total?: number;
  cost?: { input: number; output: number; cacheRead?: number; cacheWrite?: number; total: number };
}

// ─── Stream Protocol Contracts ────────────────────────────────────────────────

export interface StreamError {
  name: string;
  message: string;
  code?: string;
  status?: number;
  retryable?: boolean;
  retryAfterMs?: number;
  providerType?: string;
  provider?: string;
}

export type StreamEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'retry'; attempt: number; maxAttempts: number; delayMs: number; error: StreamError }
  | { type: 'done'; message: AssistantMessage; usage: TokenUsage; finishReason: string }
  | { type: 'error'; error: StreamError; partial?: AssistantMessage };

export interface StreamResult {
  message: AssistantMessage;
  usage: TokenUsage;
  finishReason: string;
  error?: StreamError;
}

export interface ModelStream extends AsyncIterable<StreamEvent> {
  result(): Promise<StreamResult>;
}

export interface StreamRequest {
  messages: readonly Message[];
  tools?: readonly ToolSpec[];
  effort?: ReasoningEffort;
  temperature?: number;
  abortSignal?: AbortSignal;
}

export type StreamFn = (req: StreamRequest) => ModelStream;

// ─── Loop Result Contracts ────────────────────────────────────────────────────

export type AgentRunStopReason = 'natural' | 'step-limit' | 'aborted' | 'error';

export interface AgentRunResult {
  newMessages: Message[];
  stopReason: AgentRunStopReason;
  usage: TokenUsage;
  finishReason: string;
  error?: StreamError;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  text: string;
  reasoning?: string;
  toolResults: readonly ToolResult[];
}
