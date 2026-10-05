import type { ModelSelection } from './types.js';

/**
 * Global engine constants and default safety limits.
 */
export const SAFETY_STEP_CEILING = 50;

/**
 * Default fallback model when no configuration is specified.
 */
export const DEFAULT_MODEL: ModelSelection = {
  provider: 'google',
  modelId: 'gemini-2.5-flash',
  effort: 'medium',
};
