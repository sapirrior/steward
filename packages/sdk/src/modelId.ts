import { StewardSDKError } from './errors.js';
import type { ParsedModelIdentifier } from './types.js';

/**
 * Parses a model identifier string into provider and modelId components.
 *
 * Rules:
 * - Splits strictly on the FIRST slash ('/').
 *   e.g. 'openrouter/openrouter/free' -> provider: 'openrouter', modelId: 'openrouter/free'
 *   e.g. 'anthropic/claude-sonnet-4-5' -> provider: 'anthropic', modelId: 'claude-sonnet-4-5'
 * - Provider is trimmed and normalized to lower-case.
 * - Model ID is trimmed but preserves its original case.
 * - Throws StewardSDKError ('invalid-input') if input has no slash, or if either segment is empty.
 */
export function parseModelIdentifier(input: string): ParsedModelIdentifier {
  if (typeof input !== 'string') {
    throw new StewardSDKError({
      kind: 'invalid-input',
      message: 'Model identifier must be a string.',
      retryable: false,
    });
  }

  const trimmed = input.trim();
  const firstSlashIndex = trimmed.indexOf('/');

  if (firstSlashIndex === -1) {
    throw new StewardSDKError({
      kind: 'invalid-input',
      message: `Invalid model identifier '${input}'. Expected 'provider/modelId' format.`,
      retryable: false,
    });
  }

  const rawProvider = trimmed.slice(0, firstSlashIndex).trim();
  const rawModelId = trimmed.slice(firstSlashIndex + 1).trim();

  if (!rawProvider) {
    throw new StewardSDKError({
      kind: 'invalid-input',
      message: `Invalid model identifier '${input}': provider component cannot be empty.`,
      retryable: false,
    });
  }

  if (!rawModelId) {
    throw new StewardSDKError({
      kind: 'invalid-input',
      message: `Invalid model identifier '${input}': model ID component cannot be empty.`,
      retryable: false,
    });
  }

  return {
    provider: rawProvider.toLowerCase(),
    modelId: rawModelId,
  };
}
