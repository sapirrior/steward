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

export async function fetchOpenAIModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({
      provider: 'openai' as const,
      modelId: item.id,
    }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchGeminiModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/models', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Gemini API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .map((item) => (typeof item.id === 'string' ? item.id.replace(/^models\//, '') : ''))
    .filter((id) => id && !NON_CHAT_MODEL_KEYWORDS.test(id))
    .map((id) => ({
      provider: 'gemini' as const,
      modelId: id,
    }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchAnthropicModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API request failed: HTTP ${response.status} (${response.statusText})`,
    );
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) {
    return [];
  }

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({
      provider: 'anthropic' as const,
      modelId: item.id,
    }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchDeepSeekModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.deepseek.com/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `DeepSeek API request failed: HTTP ${response.status} (${response.statusText})`,
    );
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({ provider: 'deepseek' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

interface OpenRouterModelEntry {
  id: string;
  architecture?: { output_modalities?: string[] };
}
interface OpenRouterModelsPage {
  data?: OpenRouterModelEntry[];
  links?: { next?: string | null };
}

export async function fetchOpenRouterModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const results: DiscoveredModel[] = [];
  let url: string | null = 'https://openrouter.ai/api/v1/models';

  while (url) {
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
        if (typeof item.id !== 'string') continue;
        const hasTextModality = item.architecture?.output_modalities?.includes('text');
        if (hasTextModality === false) continue;
        if (!NON_CHAT_MODEL_KEYWORDS.test(item.id)) {
          results.push({ provider: 'openrouter', modelId: item.id });
        }
      }
    }

    const next = payload.links?.next ?? null;
    url = next ? new URL(next, 'https://openrouter.ai').toString() : null;
  }

  return results.sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchGroqModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Groq API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({ provider: 'groq' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchXAIModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.x.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`xAI API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({ provider: 'xai' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchMistralModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.mistral.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Mistral API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({ provider: 'mistral' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchOllamaModels(
  baseUrl = 'http://localhost:11434/v1',
  timeoutMs = 3_000,
): Promise<DiscoveredModel[]> {
  const endpoint = baseUrl.replace(/\/+$/, '') + '/models';
  const response = await fetch(endpoint, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Ollama API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id))
    .map((item) => ({ provider: 'ollama' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export async function fetchGitHubCopilotModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<DiscoveredModel[]> {
  const response = await fetch('https://api.individual.githubcopilot.com/models', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'GitHubCopilotChat/0.35.0',
      'Editor-Version': 'vscode/1.107.0',
      'Editor-Plugin-Version': 'copilot-chat/0.35.0',
      'Copilot-Integration-Id': 'vscode-chat',
      'X-GitHub-Api-Version': '2026-06-01',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(
      `GitHub Copilot API request failed: HTTP ${response.status} (${response.statusText})`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ id: string; capabilities?: { supports?: { tool_calls?: boolean } } }>;
  };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        !NON_CHAT_MODEL_KEYWORDS.test(item.id) &&
        item.capabilities?.supports?.tool_calls !== false,
    )
    .map((item) => ({ provider: 'github-copilot' as const, modelId: item.id }))
    .sort((a, b) => a.modelId.localeCompare(b.modelId));
}

export interface DiscoveryAuthContext {
  getApiKey(provider: ProviderId): Promise<string | undefined> | string | undefined;
  getCustomEndpoint?(): { baseURL?: string; modelName?: string; apiKey?: string } | undefined;
  getOllamaEndpoint?(): string | undefined;
}

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

  // 1. OpenAI
  const openaiKey = await authCtx.getApiKey('openai');
  if (openaiKey) {
    tasks.push(
      fetchOpenAIModels(openaiKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.openai = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.openai = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 2. Gemini
  const geminiKey = await authCtx.getApiKey('gemini');
  if (geminiKey) {
    tasks.push(
      fetchGeminiModels(geminiKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.gemini = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.gemini = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 3. Anthropic
  const anthropicKey = await authCtx.getApiKey('anthropic');
  if (anthropicKey) {
    tasks.push(
      fetchAnthropicModels(anthropicKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.anthropic = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.anthropic = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 4. DeepSeek
  const deepseekKey = await authCtx.getApiKey('deepseek');
  if (deepseekKey) {
    tasks.push(
      fetchDeepSeekModels(deepseekKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.deepseek = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.deepseek = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 5. OpenRouter
  const openrouterKey = await authCtx.getApiKey('openrouter');
  if (openrouterKey) {
    tasks.push(
      fetchOpenRouterModels(openrouterKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.openrouter = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.openrouter = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 6. GitHub Copilot
  const copilotKey = await authCtx.getApiKey('github-copilot');
  if (copilotKey) {
    tasks.push(
      fetchGitHubCopilotModels(copilotKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers['github-copilot'] = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers['github-copilot'] = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 7. Groq
  const groqKey = await authCtx.getApiKey('groq');
  if (groqKey) {
    tasks.push(
      fetchGroqModels(groqKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.groq = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.groq = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 7. xAI
  const xaiKey = await authCtx.getApiKey('xai');
  if (xaiKey) {
    tasks.push(
      fetchXAIModels(xaiKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.xai = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.xai = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 8. Mistral
  const mistralKey = await authCtx.getApiKey('mistral');
  if (mistralKey) {
    tasks.push(
      fetchMistralModels(mistralKey, timeoutMs)
        .then((models) => {
          result.models.push(...models);
          result.providers.mistral = {
            status: 'available',
            modelCount: models.length,
          };
        })
        .catch((err) => {
          result.providers.mistral = {
            status: 'error',
            modelCount: 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }),
    );
  }

  // 9. Ollama (Local)
  const ollamaUrl = authCtx.getOllamaEndpoint?.() || 'http://localhost:11434/v1';
  tasks.push(
    fetchOllamaModels(ollamaUrl, 2_000)
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

  // 10. Custom
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
