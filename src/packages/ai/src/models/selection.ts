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
  const lower = modelId.trim().toLowerCase();
  if (!lower) return null;

  // 1. Namespaced OpenRouter IDs, e.g. "meta-llama/llama-3.3-70b-instruct"
  if (/^[a-z0-9-_.]+\/[a-z0-9-_.]+$/.test(lower)) {
    return 'openrouter';
  }

  // 2. Explicit Copilot prefixes
  if (lower.startsWith('copilot/') || lower.startsWith('github-copilot/')) {
    return 'github-copilot';
  }

  // 3. Gemini and Gemma families
  if (lower.startsWith('gemini-') || lower.startsWith('gemma-')) {
    return 'gemini';
  }

  // 4. Anthropic Claude family
  if (lower.startsWith('claude-')) {
    return 'anthropic';
  }

  // 5. OpenAI families (gpt-*, chatgpt-*, and o-series like o1, o1-mini, o3, o3-mini, o4)
  if (lower.startsWith('gpt-') || lower.startsWith('chatgpt-') || /^o[1-9]($|-)/.test(lower)) {
    return 'openai';
  }

  // 6. DeepSeek family
  if (lower.startsWith('deepseek-')) {
    return 'deepseek';
  }

  // 7. xAI Grok family
  if (lower.startsWith('grok-')) {
    return 'xai';
  }

  // 8. Mistral families
  if (
    lower.startsWith('codestral') ||
    lower.startsWith('mistral') ||
    lower.startsWith('pixtral') ||
    lower.startsWith('ministral')
  ) {
    return 'mistral';
  }

  // 9. Conservative Ollama-style tagged names (e.g. "qwen2.5-coder:7b", "llama3.2:3b", "ollama/*")
  if (lower.startsWith('ollama/') || /^[a-z0-9_.-]+:[a-z0-9_.-]+$/.test(lower)) {
    return 'ollama';
  }

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
