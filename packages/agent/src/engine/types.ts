import type {
  ProviderName,
  ReasoningEffort,
  ModelSelection,
  TokenUsage,
  Message,
} from '@steward/services/contracts.js';

export type { ProviderName, ReasoningEffort, ModelSelection, TokenUsage, Message };

/**
 * Information describing a tool call requested by the model.
 */
export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Information describing a completed tool call execution.
 */
export interface ToolResultInfo extends ToolCallInfo {
  result: unknown;
  isError: boolean;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
}

/**
 * Standard conversation message type.
 */
export type AgentMessage = Message;

/**
 * Active configuration for an agent session.
 */
export interface SessionConfig {
  provider: ProviderName;
  modelId: string;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  maxSteps?: number;
}

/**
 * Reason explaining why a turn completed.
 */
export type TurnStopReason = 'natural' | 'step-limit' | 'aborted' | 'error';

/**
 * Summary returned upon completion of an agent turn.
 */
export interface TurnSummary {
  text: string;
  reasoning?: string;
  toolCalls: ToolResultInfo[];
  usage: TokenUsage;
  finishReason: string;
  stopReason?: TurnStopReason;
  rawMessages?: Message[];
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
  statusVerb?: string;
}
