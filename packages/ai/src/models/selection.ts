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
  'grok',
  'mistral',
  'github-copilot',
] as const;

export const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-5',
  openai: 'gpt-5.4',
  google: 'gemini-3.5-flash',
  openrouter: 'anthropic/claude-sonnet-4.5',
  grok: 'grok-2-latest',
  mistral: 'mistral-large-latest',
  'github-copilot': 'gpt-4o',
};

export function normalizeProviderId(provider?: string): ProviderId | undefined {
  if (!provider) return undefined;
  const lower = provider.trim().toLowerCase();
  if (lower === 'gemini') return 'google';
  return lower as ProviderId;
}

export function inferProviderFromModelId(modelId: string): ProviderId | null {
  const lower = modelId.trim().toLowerCase();
  if (!lower) return null;

  if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) {
    return 'google';
  }
  if (lower.startsWith('claude-')) {
    return 'anthropic';
  }
  if (lower.startsWith('grok-')) {
    return 'grok';
  }
  if (
    lower.startsWith('mistral-') ||
    lower.startsWith('codestral-') ||
    lower.startsWith('pixtral-') ||
    lower.startsWith('ministral-')
  ) {
    return 'mistral';
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
  const reqProvider = normalizeProviderId(requested?.provider);

  // 1. Explicit provider and modelId
  if (reqProvider && requested?.modelId) {
    const configured = await isConfigured(reqProvider);
    if (!configured) {
      throw new Error(`Provider "${reqProvider}" was requested, but it is not configured.`);
    }
    return {
      provider: reqProvider,
      modelId: requested.modelId,
      effort,
    };
  }

  // 2. Explicit provider with default model
  if (reqProvider) {
    const configured = await isConfigured(reqProvider);
    if (!configured) {
      throw new Error(`Provider "${reqProvider}" was requested, but it is not configured.`);
    }
    const modelId = DEFAULT_PROVIDER_MODELS[reqProvider] ?? 'default';
    return {
      provider: reqProvider,
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
  const savedProvider = normalizeProviderId(saved?.provider);
  if (savedProvider) {
    const configured = await isConfigured(savedProvider);
    if (configured) {
      return {
        provider: savedProvider,
        modelId: saved?.modelId || DEFAULT_PROVIDER_MODELS[savedProvider] || 'default',
        effort: requested?.effort ?? saved?.effort ?? CANONICAL_DEFAULT_EFFORT,
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
