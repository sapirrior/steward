import type { ProviderName } from '../config/env.js';

export type { ProviderName };

export type ReasoningEffort =
  'provider-default' | 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

export interface ModelSelection {
  provider: ProviderName;
  modelId: string;
  effort?: ReasoningEffort;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
