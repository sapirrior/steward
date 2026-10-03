/**
 * @steward/ai — Dynamic Live Model Discovery
 *
 * Discovers live chat/coding models directly from authenticated provider /v1/models endpoints.
 * Pure Web Standards, zero external dependencies, with per-provider failure isolation.
 */

import type { Model, ProviderId } from '../types.js';
import type { Provider } from '../client.js';
import type { ResolvedAuth } from '../auth.js';
import { inferProtocolForModel, fetchModelMetadata } from './models-dev.js';

export interface DiscoveredModel {
  provider: ProviderId;
  modelId: string;
  name?: string;
  reasoning?: boolean;
}

export const NON_CHAT_MODEL_REGEX =
  /(embed|similarity|search-document|dall-e|imagen|veo|whisper|tts|transcribe|speech|voice|audio|image|video|moderation|rerank|robotics|live|aqa|babbage|davinci|lyria|chirp)/i;

const DEFAULT_TIMEOUT_MS = 5000;

export interface ProviderDiscoveryConfig {
  url?: string;
  getUrl?: (auth: ResolvedAuth) => string;
  headers?: (auth: ResolvedAuth) => Record<string, string>;
  filter?: (id: string, raw?: any) => boolean;
}

import { getCopilotBaseUrl, COPILOT_HEADERS } from '../provider/github-copilot.js';

export const DISCOVERY_CONFIGS: Partial<Record<ProviderId, ProviderDiscoveryConfig>> = {
  'github-copilot': {
    getUrl: (auth) => `${getCopilotBaseUrl(auth.apiKey)}/models`,
    headers: (auth) => ({
      ...COPILOT_HEADERS,
      Authorization: `Bearer ${auth.apiKey}`,
    }),
    filter: (_id, raw) => raw?.capabilities?.supports?.tool_calls !== false,
  },
  openai: {
    url: 'https://api.openai.com/v1/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
    filter: (id) => /^(gpt-4|o1|o3|chatgpt|gpt-3\.5)/i.test(id),
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/models',
    headers: (auth) => ({
      'x-api-key': auth.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    }),
    filter: (id) => /^claude-/i.test(id),
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
    filter: (id) => /^gemini-/i.test(id),
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
  },
  mistral: {
    url: 'https://api.mistral.ai/v1/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/models',
    headers: (auth) => ({ Authorization: `Bearer ${auth.apiKey}` }),
  },
  ollama: {
    url: 'http://localhost:11434/v1/models',
  },
};

/**
 * Discovers live models from a provider's official /v1/models endpoint.
 */
export async function discoverProviderModels(
  provider: Provider,
  auth: ResolvedAuth,
  fetchFn: typeof fetch = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Model[]> {
  const config = DISCOVERY_CONFIGS[provider.id] ?? {
    url: provider.baseUrl ? `${provider.baseUrl.replace(/\/+$/, '')}/models` : undefined,
    headers: (a) => (a.apiKey ? { Authorization: `Bearer ${a.apiKey}` } : {}),
  };

  const endpointUrl = config.getUrl ? config.getUrl(auth) : config.url;
  if (!endpointUrl) return [];

  try {
    const customHeaders = config.headers ? config.headers(auth) : {};
    const res = await fetchFn(endpointUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...customHeaders,
        ...auth.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as any;
    const items: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    const models: Model[] = [];

    for (const item of items) {
      const modelId = typeof item === 'string' ? item : item?.id;
      if (!modelId || typeof modelId !== 'string') continue;

      // Filter non-chat/non-coding keywords
      if (NON_CHAT_MODEL_REGEX.test(modelId)) continue;

      // Custom provider filter
      if (config.filter && !config.filter(modelId, item)) continue;

      const meta = await fetchModelMetadata(modelId, { fetchFn }).catch(() => undefined);
      const protocol = inferProtocolForModel(provider.id, modelId);
      const isReasoning =
        meta?.reasoning ??
        (/^(o1|o3|deepseek-r1|deepseek-reasoner|grok-3)/i.test(modelId) ||
          (provider.id === 'anthropic' && modelId.includes('sonnet')));

      models.push({
        id: modelId,
        name: meta?.name || item.name || modelId,
        provider: provider.id,
        protocol,
        baseUrl: provider.baseUrl || '',
        reasoning: isReasoning,
        input: ['text'],
        contextWindow: meta?.contextWindow || 128000,
        maxOutputTokens: meta?.maxOutputTokens || 8192,
        cost: meta?.cost,
        temperature: !modelId.startsWith('o1'),
      });
    }

    return models;
  } catch {
    return [];
  }
}
