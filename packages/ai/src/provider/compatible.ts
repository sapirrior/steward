/**
 * @steward/ai — OpenAI-Compatible Custom Provider Factory
 *
 * Used for user-supplied custom/self-hosted providers (e.g. LM Studio, vLLM,
 * Azure OpenAI proxies). The built-in Ollama, OpenRouter, and GitHub Copilot
 * definitions also use this same underlying package, but they live in definitions.ts.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export interface OpenAICompatibleProviderOptions {
  /** Steward provider id for this custom provider */
  id: string;
  /** Human-readable name — also becomes the providerMetadata namespace key */
  name: string;
  /** Base URL of the OpenAI-compatible endpoint */
  baseUrl: string;
  /** Optional default model ID */
  defaultModelId?: string;
  /** Env vars to check for API key */
  envVars?: readonly string[];
  /** Whether the provider works without an API key */
  keyless?: boolean;
}

import type { Provider } from '../client.js';

/**
 * Builds a custom OpenAI-compatible provider.
 * Used by callers who supply their own endpoint (e.g. self-hosted LLM servers).
 */
export function buildOpenAICompatibleModel(
  opts: OpenAICompatibleProviderOptions,
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const provider = createOpenAICompatible({
    name: opts.name,
    baseURL: opts.baseUrl,
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return provider(modelId);
}

export function openAICompatibleProvider(opts: OpenAICompatibleProviderOptions): Provider {
  return {
    id: opts.id as any,
    name: opts.name,
    baseUrl: opts.baseUrl,
    defaultModelId: opts.defaultModelId,
    envVars: opts.envVars ? [...opts.envVars] : [],
    keyless: opts.keyless ?? false,
    authScheme: 'bearer',
    namespace: opts.name,
    languageModel(modelId, auth, fetchFn) {
      return buildOpenAICompatibleModel(opts, modelId, auth, fetchFn);
    },
    streams: {},
  };
}
