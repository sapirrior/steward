/**
 * @steward/ai — Provider Index
 *
 * Exports:
 * - builtinProviders(): builds the Provider[] list wiring SDK factories into the legacy Provider shape
 * - Legacy factory function names preserved for public API compatibility (G1 gate)
 * - openAICompatibleProvider() for custom/self-hosted endpoints
 */

import type { Provider } from '../client.js';
import type { ProtocolId } from '../types.js';
import {
  PROVIDER_DEFINITIONS,
  getProviderDefinition,
  type ProviderDefinition,
  type FetchFn,
  type ResolvedAuth,
} from './definitions.js';
import {
  buildOpenAICompatibleModel,
  type OpenAICompatibleProviderOptions,
} from './compatible.js';

export type { OpenAICompatibleProviderOptions };
export { getProviderDefinition, type ProviderDefinition, type FetchFn, type ResolvedAuth };

// ─── Core: map definitions → Provider shape ───────────────────────────────────

function definitionToProvider(def: ProviderDefinition): Provider {
  return {
    id: def.id,
    name: def.name,
    baseUrl: def.baseUrl ?? '',
    defaultModelId: def.defaultModelId,
    envVars: [...def.envVars],
    keyless: def.keyless ?? false,
    authScheme: def.authScheme ?? 'bearer',
    namespace: def.namespace,
    // Additive: SDK language model factory hook (plan.md D2)
    languageModel(modelId: string, auth: ResolvedAuth, fetchFn?: FetchFn) {
      return def.factory(modelId, auth, fetchFn);
    },
    // Legacy streams kept so faux/testing/custom providers still work (plan.md D2)
    streams: {},
  };
}

/** All built-in providers wired with their SDK factories */
export function builtinProviders(): Provider[] {
  return PROVIDER_DEFINITIONS.map(definitionToProvider);
}

// ─── Legacy factory names (G1 gate — all consumed by cli via @steward/ai) ─────

export function anthropicProvider(): Provider {
  return definitionToProvider(getProviderDefinition('anthropic')!);
}

export function openAIProvider(): Provider {
  return definitionToProvider(getProviderDefinition('openai')!);
}

export function googleProvider(): Provider {
  return definitionToProvider(getProviderDefinition('google')!);
}

export function mistralProvider(): Provider {
  return definitionToProvider(getProviderDefinition('mistral')!);
}

export function grokProvider(): Provider {
  return definitionToProvider(getProviderDefinition('grok')!);
}

export function openRouterProvider(): Provider {
  return definitionToProvider(getProviderDefinition('openrouter')!);
}

export function deepseekProvider(): Provider {
  return definitionToProvider(getProviderDefinition('deepseek')!);
}

export function ollamaProvider(): Provider {
  return definitionToProvider(getProviderDefinition('ollama')!);
}

export function githubCopilotProvider(): Provider {
  return definitionToProvider(getProviderDefinition('github-copilot')!);
}

export function groqProvider(): Provider {
  return definitionToProvider(getProviderDefinition('groq')!);
}

/**
 * Factory for custom/self-hosted OpenAI-compatible providers.
 * Public API — kept stable (G1 gate).
 */
export function openAICompatibleProvider(opts: OpenAICompatibleProviderOptions): Provider {
  const protocolLabel: ProtocolId = 'openai-completions';
  return {
    id: opts.id as any,
    name: opts.name,
    baseUrl: opts.baseUrl,
    defaultModelId: opts.defaultModelId,
    envVars: opts.envVars ? [...opts.envVars] : [],
    keyless: opts.keyless ?? false,
    authScheme: 'bearer',
    namespace: opts.name, // name is the providerMetadata namespace key for compatible providers
    languageModel(modelId: string, auth: ResolvedAuth, fetchFn?: FetchFn) {
      return buildOpenAICompatibleModel(opts, modelId, auth, fetchFn);
    },
    streams: {},
  };
}
