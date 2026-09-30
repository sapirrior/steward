/**
 * @steward/ai - OpenAI-Compatible Provider Factory
 *
 * Use this factory to create custom providers for:
 * - Local servers (Ollama, LM Studio, vLLM, llama.cpp, LocalAI)
 * - Hosted providers (DeepSeek, Groq, xAI, Mistral, Together, Together AI)
 * - Enterprise OpenAI Proxies / Azure OpenAI
 */

import type { Provider } from '../client.js';
import type { Model, OpenAICompletionsCompat } from '../types.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export interface OpenAICompatibleProviderOptions {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  envVars?: readonly string[];
  keyless?: boolean;
  models?: readonly Model[];
  compat?: OpenAICompletionsCompat;
  defaultModelId?: string;
}

export function openAICompatibleProvider(options: OpenAICompatibleProviderOptions): Provider {
  const { id, name, baseUrl, apiKey, envVars = [], keyless = false, compat, defaultModelId } = options;

  let localModels = [...(options.models ?? [])];

  return {
    id,
    name,
    baseUrl,
    defaultModelId,
    auth: {
      apiKey: {
        envVars,
        resolve: (credential) => {
          if (credential.type === 'api-key' && credential.key) {
            return { apiKey: credential.key, source: 'stored-credential', baseUrl };
          }
          if (apiKey) {
            return { apiKey, source: 'options', baseUrl };
          }
          if (keyless) {
            return { apiKey: '', source: 'keyless', baseUrl };
          }
          return undefined;
        },
      },
    },
    models: () => localModels,
    async fetchModels(auth, fetchFn, signal) {
      try {
        const url = `${baseUrl.replace(/\/+$/, '')}/models`;
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (auth.apiKey) headers['Authorization'] = `Bearer ${auth.apiKey}`;

        const res = await fetchFn(url, { method: 'GET', headers, signal });
        if (!res.ok) return localModels;

        const data = (await res.json()) as { data?: Array<{ id: string }> };
        if (Array.isArray(data.data)) {
          localModels = data.data.map((item) => ({
            id: item.id,
            name: item.id,
            provider: id,
            protocol: 'openai-completions',
            baseUrl,
            reasoning: false,
            compat,
            maxOutputTokens: 4096,
          }));
        }
      } catch {
        // preserve existing
      }
      return localModels;
    },
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
