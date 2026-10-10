import type { ModelMessage, ThreadUsage } from '@steward/threads';
import type { ModelRef } from '@steward/models';
import type { ToolRegistry } from '../tools/ToolRegistry.js';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export type AgentFinishReason = 'stop' | 'tool-calls' | 'max-steps' | 'aborted' | 'error';

export type AgentErrorCode =
  | 'AUTH_MISSING'
  | 'AUTH_INVALID'
  | 'RATE_LIMITED'
  | 'SERVER_OVERLOADED'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'STEP_LIMIT_EXCEEDED'
  | 'TOOL_EXECUTION_ERROR'
  | 'ABORTED'
  | 'UNKNOWN';

import type { AgentError } from './errors/AgentError.js';

export interface AgentRetryEvent {
  type: 'retry';
  attempt: number;
  maxRetries: number;
  delayMs: number;
  error: AgentError;
}

export interface AgentErrorEvent {
  type: 'error';
  error: AgentError;
}

export interface AgentStepStartEvent {
  type: 'step-start';
  stepIndex: number;
  timestamp: number;
}

export interface AgentStepEndEvent {
  type: 'step-end';
  stepIndex: number;
  usage?: ThreadUsage;
}

export interface AgentTextDeltaEvent {
  type: 'text-delta';
  text: string;
}

export interface AgentReasoningDeltaEvent {
  type: 'reasoning-delta';
  text: string;
}

export interface AgentToolCallStartEvent {
  type: 'tool-call-start';
  toolCallId: string;
  toolName: string;
  tagline: string;
  args: Record<string, unknown>;
}

export interface AgentToolCallResultEvent {
  type: 'tool-call-result';
  toolCallId: string;
  toolName: string;
  tagline: string;
  isError: boolean;
  result: unknown;
  durationMs: number;
}

export interface AgentFinishEvent {
  type: 'finish';
  responseMessages: ModelMessage[];
  usage: ThreadUsage;
  finishReason: AgentFinishReason;
}

export type AgentEvent =
  | AgentStepStartEvent
  | AgentStepEndEvent
  | AgentReasoningDeltaEvent
  | AgentTextDeltaEvent
  | AgentToolCallStartEvent
  | AgentToolCallResultEvent
  | AgentRetryEvent
  | AgentErrorEvent
  | AgentFinishEvent;

export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterFactor?: number;
}

export interface AgentRunOptions {
  modelRef: ModelRef | string;
  messages: ModelMessage[];
  tools?: ToolRegistry;
  systemPrompt?: string;
  runtimeContext?: string;
  maxSteps?: number;
  reasoning?: ReasoningEffort | number;
  fallbackModelRef?: ModelRef | string;
  retry?: RetryConfig;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  responseMessages: ModelMessage[];
  usage: ThreadUsage;
  finishReason: AgentFinishReason;
  error?: AgentError;
}
