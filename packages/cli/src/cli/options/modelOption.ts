import { parseModelRef, type ModelRef } from '@steward/models';

/**
 * Resolves a model option string into a structured ModelRef.
 *
 * Rules:
 * - If `provider/modelId` format is provided, uses `@steward/models` `parseModelRef`.
 * - If a bare `modelId` (no slash) is provided, uses `defaultProvider` (fallback: 'google').
 * - Handles OpenRouter models with multiple slashes (e.g. `openrouter/deepseek/deepseek-r1` -> provider: `openrouter`, modelId: `deepseek/deepseek-r1`).
 */
export function resolveModelOption(
  rawModel?: string,
  defaultProvider: string = 'google',
  defaultModel: string = 'gemini-flash-latest',
): ModelRef {
  if (!rawModel || !rawModel.trim()) {
    return {
      provider: defaultProvider,
      modelId: defaultModel,
    };
  }

  const trimmed = rawModel.trim();
  const parsed = parseModelRef(trimmed);

  if (parsed) {
    return parsed;
  }

  // Bare model identifier without slash
  return {
    provider: defaultProvider,
    modelId: trimmed,
  };
}
