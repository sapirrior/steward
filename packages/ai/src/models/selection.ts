/**
 * @steward/ai - Model Selection Resolution
 */

import type { ModelSelection, ProviderId, ReasoningEffort } from '../types.js';

export interface ModelSelectionRequest {
  provider?: ProviderId;
  modelId?: string;
  effort?: ReasoningEffort;
}

export const CANONICAL_DEFAULT_EFFORT: ReasoningEffort = 'medium';

export const PROVIDER_SELECTION_PRIORITY: readonly ProviderId[] = [
  'anthropic',
  'openai',
  'google',
  'openrouter',
] as const;

export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-5.4',
  google: 'gemini-3.5-flash',
  openrouter: 'anthropic/claude-sonnet-4.5',
};

export function inferProviderFromModelId(modelId: string): ProviderId | null {
  const lower = modelId.trim().toLowerCase();
  if (!lower) return null;

  if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) {
    return 'google';
  }
  if (lower.startsWith('claude-')) {
    return 'anthropic';
  }
  if (lower.startsWith('gpt-') || lower.startsWith('chatgpt-') || /^o[1-9]($|-)/.test(lower)) {
    return 'openai';
  }
  if (/^[a-z0-9-_.]+\/[a-z0-9-_.]+$/.test(lower)) {
    return 'openrouter';
  }

  return null;
}

export interface ModelResolutionContext {
  isConfigured: (provider: ProviderId) => boolean | Promise<boolean>;
  getSavedSelection?: () =>
    | ModelSelectionRequest
    | undefined
    | Promise<ModelSelectionRequest | undefined>;
}

export async function resolveModelSelection(
  requested?: ModelSelectionRequest,
  context?: ModelResolutionContext,
): Promise<ModelSelection> {
  const effort: ReasoningEffort = requested?.effort ?? CANONICAL_DEFAULT_EFFORT;
  const isConfigured = context?.isConfigured ?? (() => true);

  // 1. Explicit provider and modelId
  if (requested?.provider && requested?.modelId) {
    const configured = await isConfigured(requested.provider);
    if (!configured) {
      throw new Error(`Provider "${requested.provider}" was requested, but it is not configured.`);
    }
    return {
      provider: requested.provider,
      modelId: requested.modelId,
      effort,
    };
  }

  // 2. Explicit provider with default model
  if (requested?.provider) {
    const configured = await isConfigured(requested.provider);
    if (!configured) {
      throw new Error(`Provider "${requested.provider}" was requested, but it is not configured.`);
    }
    const modelId = DEFAULT_PROVIDER_MODELS[requested.provider] ?? 'default';
    return {
      provider: requested.provider,
      modelId,
      effort,
    };
  }

  // 3. Explicit modelId with inferred provider
  if (requested?.modelId) {
    const inferred = inferProviderFromModelId(requested.modelId);
    if (inferred) {
      const configured = await isConfigured(inferred);
      if (configured) {
        return {
          provider: inferred,
          modelId: requested.modelId,
          effort,
        };
      }
    }
  }

  // 4. Saved preference
  const saved = await context?.getSavedSelection?.();
  if (saved?.provider) {
    const configured = await isConfigured(saved.provider);
    if (configured) {
      return {
        provider: saved.provider,
        modelId: saved.modelId || DEFAULT_PROVIDER_MODELS[saved.provider] || 'default',
        effort: requested?.effort ?? saved.effort ?? CANONICAL_DEFAULT_EFFORT,
      };
    }
  }

  // 5. Priority order
  for (const provider of PROVIDER_SELECTION_PRIORITY) {
    if (await isConfigured(provider)) {
      const modelId = DEFAULT_PROVIDER_MODELS[provider] || 'default';
      return {
        provider,
        modelId,
        effort,
      };
    }
  }

  throw new Error('No model providers configured.');
}
