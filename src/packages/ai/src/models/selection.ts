/**
 * @steward/ai - Model Selection Resolution
 */

import type { ModelSelection, ProviderId, ReasoningEffort } from '../types.js';
import { PROVIDER_REGISTRY } from './registry.js';

export interface ModelSelectionRequest {
  provider?: ProviderId;
  modelId?: string;
  effort?: ReasoningEffort;
}

export const CANONICAL_DEFAULT_EFFORT: ReasoningEffort = 'medium';

export const PROVIDER_SELECTION_PRIORITY: readonly ProviderId[] = [
  'gemini',
  'anthropic',
  'openai',
  'deepseek',
  'groq',
  'xai',
  'mistral',
  'github-copilot',
  'ollama',
  'openrouter',
  'custom',
] as const;

export function inferProviderFromModelId(modelId: string): ProviderId | null {
  const lower = modelId.toLowerCase();

  // Namespaced OpenRouter IDs, e.g. "openai/gpt-4", "anthropic/claude-sonnet-5"
  if (/^[a-z0-9-_.]+\/[a-z0-9-_.]+$/.test(lower)) return 'openrouter';

  if (lower.startsWith('copilot/') || lower.startsWith('github-copilot/')) return 'github-copilot';
  if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) return 'gemini';
  if (lower.startsWith('claude-')) return 'anthropic';
  if (
    lower.startsWith('gpt-') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3') ||
    lower.startsWith('chatgpt-')
  ) {
    return 'openai';
  }
  if (lower.startsWith('deepseek-')) return 'deepseek';
  if (lower.startsWith('grok-')) return 'xai';
  if (
    lower.startsWith('codestral') ||
    lower.startsWith('mistral') ||
    lower.startsWith('pixtral') ||
    lower.startsWith('ministral')
  )
    return 'mistral';
  if (lower.includes(':latest') || lower.startsWith('ollama/')) return 'ollama';
  return null;
}

export interface ModelResolutionContext {
  isConfigured: (provider: ProviderId) => boolean | Promise<boolean>;
  getSavedSelection?: () =>
    ModelSelectionRequest | undefined | Promise<ModelSelectionRequest | undefined>;
  getCustomModelName?: () => string | undefined;
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
    let modelId = PROVIDER_REGISTRY[requested.provider].defaultModel;
    if (requested.provider === 'custom' && context?.getCustomModelName?.()) {
      modelId = context.getCustomModelName() || modelId;
    }
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
        modelId: saved.modelId || PROVIDER_REGISTRY[saved.provider].defaultModel,
        effort: requested?.effort ?? saved.effort ?? CANONICAL_DEFAULT_EFFORT,
      };
    }
  }

  // 5. Priority order
  for (const provider of PROVIDER_SELECTION_PRIORITY) {
    if (await isConfigured(provider)) {
      let modelId = PROVIDER_REGISTRY[provider].defaultModel;
      if (provider === 'custom' && context?.getCustomModelName?.()) {
        modelId = context.getCustomModelName() || modelId;
      }
      return {
        provider,
        modelId,
        effort,
      };
    }
  }

  throw new Error('No model providers configured.');
}
