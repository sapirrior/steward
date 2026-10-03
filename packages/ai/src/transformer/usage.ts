/**
 * @steward/ai — Transformer: Usage Normalization
 *
 * Converts AI SDK LanguageModelUsage → Steward TokenUsage.
 * Also maps SDK FinishReason → Steward FinishReason.
 * Pure functions, no I/O.
 */

import type { LanguageModelUsage } from 'ai';
import type { FinishReason, TokenUsage } from '../types.js';
import type { NamespaceConfig } from './config.js';

/**
 * Converts AI SDK usage shape → Steward canonical TokenUsage.
 * Resolves D-G (double-counting): uses noCacheTokens for canonical `input`
 * so cached tokens are NOT double-counted.
 */
export function normalizeUsage(
  sdkUsage: LanguageModelUsage,
  config: NamespaceConfig,
): TokenUsage {
  const { inputTokens, inputTokenDetails, outputTokens, outputTokenDetails, totalTokens } =
    sdkUsage;

  let input: number | undefined;
  if (config.usageMode === 'already-uncached') {
    input = inputTokens ?? undefined;
  } else {
    // Prefer noCacheTokens (uncached input only) to avoid counting cached reads
    input =
      inputTokenDetails?.noCacheTokens !== undefined
        ? inputTokenDetails.noCacheTokens
        : (inputTokens ?? undefined);
  }

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
 * Maps SDK FinishReason string → Steward FinishReason.
 * Uses the namespace config table — no provider conditionals.
 */
export function normalizeFinishReason(
  sdkReason: string | undefined,
  config: NamespaceConfig,
  hasToolCalls: boolean,
): { finishReason: FinishReason; errorMessage?: string } {
  if (!sdkReason) {
    return { finishReason: hasToolCalls ? 'tool-use' : 'stop' };
  }

  // Some providers (e.g. Ollama) don't set finish=tool-calls even when tools fire
  if (hasToolCalls && config.inferToolUseFromParts && sdkReason !== 'tool-calls') {
    return { finishReason: 'tool-use' };
  }

  const entry = config.finishReasonMap[sdkReason];
  if (!entry) {
    return { finishReason: 'stop' };
  }
  return { finishReason: entry.steward, errorMessage: entry.errorMessage };
}
