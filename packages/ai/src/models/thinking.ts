/**
 * @steward/ai - Thinking & Reasoning Effort Resolver
 *
 * Full scale matching pi: ['none', 'low', 'medium', 'high', 'xhigh']
 * Maps abstract ReasoningEffort tiers to per-model configuration,
 * with capability clamping and graceful fallback.
 */

import type { Model, ReasoningEffort } from '../types.js';

export const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
];

/**
 * Returns all reasoning efforts supported by the given model.
 * If model.reasoning is false, returns ['none'].
 */
export function getSupportedEfforts(model: Model): readonly ReasoningEffort[] {
  if (!model.reasoning) return ['none'];

  if (!model.thinkingLevelMap) {
    return REASONING_EFFORTS;
  }

  return REASONING_EFFORTS.filter((effort) => {
    const val = model.thinkingLevelMap?.[effort];
    // If explicitly null, it is unsupported. If undefined or non-null, supported.
    return val !== null;
  });
}

/**
 * Clamps a requested reasoning effort to the nearest supported effort for the model.
 * If the model does not support reasoning, always returns 'none'.
 * If the requested effort is unsupported, searches down first, then up.
 */
export function clampThinkingEffort(model: Model, requested: ReasoningEffort): ReasoningEffort {
  const supported = getSupportedEfforts(model);
  if (supported.includes(requested)) {
    return requested;
  }

  const requestedIdx = REASONING_EFFORTS.indexOf(requested);
  if (requestedIdx === -1) return supported[0] ?? 'none';

  // Search downwards first (prefer lower supported effort)
  for (let i = requestedIdx - 1; i >= 0; i--) {
    const candidate = REASONING_EFFORTS[i];
    if (supported.includes(candidate)) return candidate;
  }

  // Search upwards
  for (let i = requestedIdx + 1; i < REASONING_EFFORTS.length; i++) {
    const candidate = REASONING_EFFORTS[i];
    if (supported.includes(candidate)) return candidate;
  }

  return supported[0] ?? 'none';
}

/**
 * Translates an effort level into an Anthropic budget_tokens number.
 * Ensures the budget is at least 1024 tokens and at most maxOutputTokens - 1024.
 */
export function calculateAnthropicBudgetTokens(
  effort: ReasoningEffort,
  maxOutputTokens: number,
): number | undefined {
  if (effort === 'none') return undefined;

  const maxBudget = Math.max(1024, maxOutputTokens - 1024);
  let budget: number;

  switch (effort) {
    case 'low':
      budget = 2048;
      break;
    case 'medium':
      budget = 4096;
      break;
    case 'high':
      budget = 16384;
      break;
    case 'xhigh':
      budget = 32768;
      break;
    default:
      budget = 4096;
  }

  return Math.min(budget, maxBudget);
}
