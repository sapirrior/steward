/**
 * @steward/ai - Model Discovery
 */

import type { ProviderId } from '../types.js';

export interface DiscoveredModel {
  provider: ProviderId;
  modelId: string;
  name?: string;
  reasoning?: boolean;
}

export interface ProviderDiscoveryStatus {
  status: 'available' | 'unconfigured' | 'error';
  modelCount: number;
  error?: string;
}

export interface ModelDiscoveryResult {
  models: DiscoveredModel[];
  providers: Record<ProviderId, ProviderDiscoveryStatus>;
}

export const NON_CHAT_MODEL_KEYWORDS =
  /(embed|similarity|search-document|dall-e|imagen|veo|whisper|tts|transcribe|speech|voice|audio|image|video|moderation|rerank|robotics|live|aqa|babbage|davinci|lyria|chirp)/i;

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

interface StandardModelItem {
  id?: string;
  capabilities?: {
    supports?: {
      tool_calls?: boolean;
    };
  };
}

interface StandardModelsPayload {
  data?: StandardModelItem[];
}

async function fetchStandardModelsList(options: {
  provider: ProviderId;
  url: string;
  headers?: Record<string, string>;
  timeoutMs: number;
  transformId?: (rawId: string) => string;
  filterItem?: (item: StandardModelItem) => boolean;
}): Promise<DiscoveredModel[]> {
  const { provider, url, headers, timeoutMs, transformId, filterItem } = options;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `${provider} API request failed: HTTP ${response.status} (${response.statusText})`,
    );
  }

  const payload = (await response.json()) as StandardModelsPayload;
  if (!Array.isArray(payload.data)) {
    return [];
  }

  const models: DiscoveredModel[] = [];
  for (const item of payload.data) {
    if (!item || typeof item.id !== 'string') continue;
    if (filterItem && !filterItem(item)) continue;

    const finalId = transformId ? transformId(item.id) : item.id;
    if (!finalId || NON_CHAT_MODEL_KEYWORDS.test(finalId)) continue;

    models.push({
      provider,
      modelId: finalId,
    });
  }

  return models.sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchOpenAIModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'openai',
    url: 'https://api.openai.com/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
  });
}

export async function fetchGeminiModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
    transformId: (id) => id.replace(/^models\//, ''),
  });
}

export async function fetchAnthropicModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'anthropic',
    url: 'https://api.anthropic.com/v1/models',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    timeoutMs,
  });
}

export async function fetchDeepSeekModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'deepseek',
    url: 'https://api.deepseek.com/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
  });
}

interface OpenRouterModelEntry {
  id: string;
  architecture?: { output_modalities?: string[] };
}

interface OpenRouterModelsPage {
  data?: OpenRouterModelEntry[];
  links?: { next?: string | null };
}

function isValidOpenRouterNextUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl, 'https://openrouter.ai');
    return (
      parsed.protocol === 'https:' &&
      parsed.origin === 'https://openrouter.ai' &&
      parsed.pathname.startsWith('/api/v1/models')
    );
  } catch {
    return false;
  }
}

export async function fetchOpenRouterModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const results: DiscoveredModel[] = [];
  let url: string | null = 'https://openrouter.ai/api/v1/models';
  const seenUrls = new Set<string>();
  const MAX_PAGES = 20;
  let pageCount = 0;

  while (url && pageCount < MAX_PAGES) {
    if (seenUrls.has(url)) break;
    seenUrls.add(url);
    pageCount++;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `OpenRouter API request failed: HTTP ${response.status} (${response.statusText})`,
      );
    }

    const payload = (await response.json()) as OpenRouterModelsPage;
    if (Array.isArray(payload.data)) {
      for (const item of payload.data) {
        if (!item || typeof item.id !== 'string') continue;
        const hasTextModality = item.architecture?.output_modalities?.includes('text');
        if (hasTextModality === false) continue;
        if (!NON_CHAT_MODEL_KEYWORDS.test(item.id)) {
          results.push({ provider: 'openrouter', modelId: item.id });
        }
      }
    }

    const next = payload.links?.next;
    if (typeof next === 'string' && next.trim() && isValidOpenRouterNextUrl(next)) {
      url = new URL(next, 'https://openrouter.ai').toString();
    } else {
      url = null;
    }
  }

  return results.sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchGroqModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'groq',
    url: 'https://api.groq.com/openai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
  });
}

export async function fetchXAIModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'xai',
    url: 'https://api.x.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
  });
}

export async function fetchMistralModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'mistral',
    url: 'https://api.mistral.ai/v1/models',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeoutMs,
  });
}

export async function fetchOllamaModels(
  baseUrl = 'http://localhost:11434/v1',
  timeoutMs = 3_000,
): Promise<DiscoveredModel[]> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/models`;
  return await fetchStandardModelsList({
    provider: 'ollama',
    url: endpoint,
    timeoutMs,
  });
}

export async function fetchGitHubCopilotModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  return await fetchStandardModelsList({
    provider: 'github-copilot',
    url: 'https://api.individual.githubcopilot.com/models',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'GitHubCopilotChat/0.35.0',
      'Editor-Version': 'vscode/1.107.0',
      'Editor-Plugin-Version': 'copilot-chat/0.35.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'X-GitHub-Api-Version': '2026-06-01',
    },
    timeoutMs,
    filterItem: (item) => item.capabilities?.supports?.tool_calls !== false,
  });
}

export interface DiscoveryAuthContext {
  getApiKey(provider: ProviderId): Promise<string | undefined> | string | undefined;
  getCustomEndpoint?(): { baseURL?: string; modelName?: string; apiKey?: string } | undefined;
  getOllamaEndpoint?(): string | undefined;
}

type ProviderFetcher = (apiKey: string, timeoutMs: number) => Promise<DiscoveredModel[]>;

const API_KEY_FETCHERS: Partial<Record<ProviderId, ProviderFetcher>> = {
  openai: fetchOpenAIModels,
  gemini: fetchGeminiModels,
  anthropic: fetchAnthropicModels,
  deepseek: fetchDeepSeekModels,
  openrouter: fetchOpenRouterModels,
  'github-copilot': fetchGitHubCopilotModels,
  groq: fetchGroqModels,
  xai: fetchXAIModels,
  mistral: fetchMistralModels,
};

export async function fetchAvailableModels(
  authCtx: DiscoveryAuthContext,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDiscoveryResult> {
  const result: ModelDiscoveryResult = {
    models: [],
    providers: {
      gemini: { status: 'unconfigured', modelCount: 0 },
      anthropic: { status: 'unconfigured', modelCount: 0 },
      openai: { status: 'unconfigured', modelCount: 0 },
      deepseek: { status: 'unconfigured', modelCount: 0 },
      openrouter: { status: 'unconfigured', modelCount: 0 },
      'github-copilot': { status: 'unconfigured', modelCount: 0 },
      groq: { status: 'unconfigured', modelCount: 0 },
      xai: { status: 'unconfigured', modelCount: 0 },
      mistral: { status: 'unconfigured', modelCount: 0 },
      ollama: { status: 'unconfigured', modelCount: 0 },
      custom: { status: 'unconfigured', modelCount: 0 },
    },
  };

  const tasks: Promise<void>[] = [];

  for (const [providerKey, fetcher] of Object.entries(API_KEY_FETCHERS)) {
    const provider = providerKey as ProviderId;
    if (!fetcher) continue;

    const apiKey = await authCtx.getApiKey(provider);
    if (apiKey) {
      tasks.push(
        fetcher(apiKey, timeoutMs)
          .then((models) => {
            result.models.push(...models);
            result.providers[provider] = {
              status: 'available',
              modelCount: models.length,
            };
          })
          .catch((err) => {
            result.providers[provider] = {
              status: 'error',
              modelCount: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }),
      );
    }
  }

  // Ollama (Local)
  const ollamaUrl = authCtx.getOllamaEndpoint?.() || 'http://localhost:11434/v1';
  const ollamaTimeout = Math.min(timeoutMs, 3_000);
  tasks.push(
    fetchOllamaModels(ollamaUrl, ollamaTimeout)
      .then((models) => {
        if (models.length > 0) {
          result.models.push(...models);
          result.providers.ollama = {
            status: 'available',
            modelCount: models.length,
          };
        }
      })
      .catch(() => {
        // Ollama not running locally, silently ignore
      }),
  );

  // Custom
  const customConfig = authCtx.getCustomEndpoint?.();
  if (customConfig?.baseURL && customConfig.modelName) {
    result.models.push({
      provider: 'custom',
      modelId: customConfig.modelName,
    });
    result.providers.custom = {
      status: 'available',
      modelCount: 1,
    };
  }

  await Promise.all(tasks);

  return result;
}
