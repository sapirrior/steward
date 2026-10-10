import type { ReasoningEffort } from '../../agent/types.js';
import { VALID_REASONING_EFFORTS } from '../types.js';

/**
 * Validates and normalizes reasoning effort option.
 * Throws clean error if an invalid effort is provided.
 */
export function resolveEffortOption(
  rawEffort?: string,
  defaultEffort: ReasoningEffort = 'medium',
): ReasoningEffort {
  if (!rawEffort || !rawEffort.trim()) {
    return defaultEffort;
  }

  const normalized = rawEffort.trim().toLowerCase() as ReasoningEffort;

  if (VALID_REASONING_EFFORTS.includes(normalized)) {
    return normalized;
  }

  throw new Error(
    `Invalid reasoning effort: '${rawEffort}'. Allowed values: ${VALID_REASONING_EFFORTS.join(', ')}`,
  );
}
