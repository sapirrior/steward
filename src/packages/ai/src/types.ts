/**
 * @steward/ai - Canonical AI Domain Contracts
 */

import type { AIError } from './errors.js';

export type ProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'openrouter'
  | 'github-copilot'
  | 'groq'
  | 'xai'
  | 'mistral'
  | 'ollama'
  | 'custom';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface ModelSelection {
  provider: ProviderId;
  modelId: string;
  effort: ReasoningEffort;
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = {
  [key: string]: JsonValue;
};

/**
 * JSON Schema is intentionally represented structurally.
 * It must not depend on Zod.
 */
export type JsonSchema = Record<string, unknown>;

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

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface UserMessage {
  role: 'user';
  content: string | readonly TextContent[];
}

export interface AssistantMessage {
  role: 'assistant';
  content: readonly AssistantContent[];
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

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type FinishReason = 'stop' | 'length' | 'tool-use' | 'error' | 'aborted';

export interface InferenceRequest {
  model: ModelSelection;
  messages: readonly Message[];
  tools?: readonly ToolSpec[];
  temperature?: number;
  abortSignal?: AbortSignal;
}

export type InferenceEvent =
  | {
      type: 'text-delta';
      delta: string;
    }
  | {
      type: 'reasoning-delta';
      delta: string;
    }
  | {
      type: 'tool-call-start';
      id: string;
      name: string;
    }
  | {
      type: 'tool-call-delta';
      id: string;
      delta: string;
    }
  | {
      type: 'tool-call-end';
      toolCall: ToolCallContent;
    }
  | {
      type: 'done';
      message: AssistantMessage;
      usage: TokenUsage;
      finishReason: FinishReason;
    }
  | {
      type: 'error';
      error: AIError;
    };

export interface InferenceStream extends AsyncIterable<InferenceEvent> {
  result(): Promise<{
    message: AssistantMessage;
    usage: TokenUsage;
    finishReason: FinishReason;
  }>;
}

export interface ModelDescriptor {
  id: string;
  name: string;
  provider: ProviderId;
  reasoning?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
}
