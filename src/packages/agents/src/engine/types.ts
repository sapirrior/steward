import type {
  ProviderName,
  ReasoningEffort,
  ModelSelection,
  TokenUsage,
} from '../../../services/src/contracts.js';

export type { ProviderName, ReasoningEffort, ModelSelection, TokenUsage };

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
 * Standard conversation message type compatible with AI SDK v7.
 */
export type AgentMessage = ModelMessage;

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
  rawMessages?: ModelMessage[];
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
  statusVerb?: string;
}
