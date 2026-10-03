/**
 * @steward/ai — Transformer: Usage Normalization
 *
 * SDK LanguageModelUsage → Steward TokenUsage.
 * Resolves D-G: prefer noCacheTokens for canonical uncached input count.
 */

import type { LanguageModelUsage } from 'ai';
import type { FinishReason, TokenUsage } from '../types.js';

export function normalizeUsage(sdkUsage: LanguageModelUsage): TokenUsage {
  const { inputTokens, inputTokenDetails, outputTokens, outputTokenDetails, totalTokens } =
    sdkUsage;

  // Prefer noCacheTokens (uncached input only) to avoid double-counting cached reads (D-G fix)
  const input =
    inputTokenDetails?.noCacheTokens !== undefined
      ? inputTokenDetails.noCacheTokens
      : (inputTokens ?? undefined);

  return {
    input,
    output: outputTokens ?? undefined,
    cacheRead: inputTokenDetails?.cacheReadTokens ?? undefined,
    cacheWrite: inputTokenDetails?.cacheWriteTokens ?? undefined,
    reasoning: outputTokenDetails?.reasoningTokens ?? undefined,
    total: totalTokens ?? undefined,
  };
}

/**
 * Maps SDK finish reason string → Steward FinishReason.
 * The SDK already normalizes provider-specific strings; we just map to our enum.
 */
export function normalizeFinishReason(
  sdkReason: string | undefined,
  hasToolCalls: boolean,
): FinishReason {
  if (hasToolCalls) return 'tool-use';
  switch (sdkReason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool-calls':
      return 'tool-use';
    case 'content-filter':
    case 'error':
      return 'error';
    default:
      return 'stop';
  }
}
