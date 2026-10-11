import type { ModelMessage } from 'ai';
import type { SDKErrorDetails } from '../types.js';

export type SDKFinishReason =
  | 'stop'
  | 'length'
  | 'content-filter'
  | 'tool-calls'
  | 'error'
  | 'other'
  | 'max-steps';

export interface SDKUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export type SDKEvent =
  | { type: 'text-delta'; text: string; id?: string }
  | { type: 'reasoning-delta'; text: string; id?: string }
  | { type: 'tool-input-start'; toolCallId: string; toolName?: string }
  | { type: 'tool-input-delta'; toolCallId: string; delta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown; isError: boolean }
  | { type: 'step-start'; stepIndex: number; timestamp: number }
  | { type: 'step-finish'; stepIndex: number; finishReason?: string; usage?: SDKUsage }
  | { type: 'retry'; attempt: number; maxRetries: number; elapsedDelayMs: number; error: SDKErrorDetails }
  | { type: 'aborted'; error: SDKErrorDetails }
  | { type: 'error'; error: SDKErrorDetails }
  | {
      type: 'finish';
      finishReason: SDKFinishReason;
      /**
       * Full, ordered generated response messages for this run (assistant and tool turns);
       * does NOT include the prior history or current user prompt.
       */
      responseMessages: readonly ModelMessage[];
      usage: SDKUsage;
      totalUsage: SDKUsage;
      steps: number;
    };
