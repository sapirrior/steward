/**
 * @steward/ai - Token cost calculation
 *
 * Calculates USD cost from token usage and per-model pricing.
 * Prices are per-million tokens. Returns undefined when model has no cost data.
 */

import type { Model, TokenCost, TokenUsage } from '../types.js';

export type { TokenCost };

/**
 * Calculates the USD cost for a completed inference.
 * Returns undefined if the model has no cost information.
 */
export function calculateCost(model: Model, usage: TokenUsage): TokenCost | undefined {
  if (!model.cost) return undefined;

  const perM = model.cost;
  const input = ((usage.input ?? 0) / 1_000_000) * perM.input;
  const output = ((usage.output ?? 0) / 1_000_000) * perM.output;
  const cacheRead = ((usage.cacheRead ?? 0) / 1_000_000) * (perM.cacheRead ?? 0);
  const cacheWrite = ((usage.cacheWrite ?? 0) / 1_000_000) * (perM.cacheWrite ?? 0);
  const total = input + output + cacheRead + cacheWrite;

  return { input, output, cacheRead, cacheWrite, total };
}
