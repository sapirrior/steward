import {
  getEnvConfig,
  type EnvConfig,
  type ProviderName,
} from '@steward/services/config/index.js';

/**
 * Normalized model descriptor schema as specified in data.txt.
 */
export interface ModelDescriptor {
  provider: ProviderName;
  model_id: string;
}

/**
 * Detailed status for each provider during discovery.
 */
export interface ProviderDiscoveryStatus {
  status: 'available' | 'unconfigured' | 'error';
  modelCount: number;
  error?: string;
}

/**
 * Result returned by the model discovery system.
 */
export interface ModelDiscoveryResult {
  models: ModelDescriptor[];
  providers: Record<ProviderName, ProviderDiscoveryStatus>;
}

// Shared exclude list matching non-chat, non-text, audio, image, video, embedding, and specialized endpoints
export const NON_CHAT_MODEL_KEYWORDS =
  /(embed|similarity|search-document|dall-e|imagen|veo|whisper|tts|transcribe|speech|voice|audio|image|video|moderation|rerank|robotics|live|aqa|babbage|davinci|lyria|chirp)/i;

const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches and filters available models from OpenAI's /v1/models endpoint.
 */
export async function fetchOpenAIModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
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
    .filter(
      (item) => typeof item.id === 'string' && !NON_CHAT_MODEL_KEYWORDS.test(item.id),
    )
    .map((item) => ({
      provider: 'openai' as const,
      model_id: item.id,
    }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

/**
 * Fetches and filters available models from Gemini's OpenAI-compatible /models endpoint.
 */
export async function fetchGeminiModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
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
      model_id: id,
    }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

/**
 * Fetches and filters available models from Anthropic's /v1/models endpoint.
 */
export async function fetchAnthropicModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
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
      model_id: item.id,
    }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

// --- xAI ---------------------------------------------------------------
export async function fetchXaiModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
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
    .map((item) => ({ provider: 'xai' as const, model_id: item.id }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

// --- Mistral -------------------------------------------------------------
// Mistral's /v1/models response is self-describing (capabilities.completion_chat),
// prefer structured signal and fall back to keyword filtering.
interface MistralModelCard {
  id: string;
  capabilities?: { completion_chat?: boolean };
  archived?: boolean;
  TYPE?: string;
}

export async function fetchMistralModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
  const response = await fetch('https://api.mistral.ai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Mistral API request failed: HTTP ${response.status} (${response.statusText})`);
  }

  const payload = (await response.json()) as { data?: MistralModelCard[] };
  if (!Array.isArray(payload.data)) return [];

  return payload.data
    .filter((item) => {
      if (typeof item.id !== 'string') return false;
      if (item.archived === true || item.TYPE === 'fine-tuned') return false;
      if (item.capabilities && typeof item.capabilities.completion_chat === 'boolean') {
        return item.capabilities.completion_chat;
      }
      return !NON_CHAT_MODEL_KEYWORDS.test(item.id);
    })
    .map((item) => ({ provider: 'mistral' as const, model_id: item.id }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

// --- DeepSeek --------------------------------------------------------------
export async function fetchDeepSeekModels(
  apiKey: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDescriptor[]> {
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
    .map((item) => ({ provider: 'deepseek' as const, model_id: item.id }))
    .sort((a, b) => a.model_id.localeCompare(b.model_id));
}

// --- OpenRouter --------------------------------------------------------------
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
): Promise<ModelDescriptor[]> {
  const results: ModelDescriptor[] = [];
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
          results.push({ provider: 'openrouter', model_id: item.id });
        }
      }
    }

    const next = payload.links?.next ?? null;
    url = next ? new URL(next, 'https://openrouter.ai').toString() : null;
  }

  return results.sort((a, b) => a.model_id.localeCompare(b.model_id));
}

/**
 * Fetches and aggregates all available models based on configured environment variables.
 * For custom models, if all custom variables are set, 'Custom' is included in the list.
 */
export async function fetchAvailableModels(
  config: EnvConfig = getEnvConfig(),
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<ModelDiscoveryResult> {
  const result: ModelDiscoveryResult = {
    models: [],
    providers: {
      gemini: { status: 'unconfigured', modelCount: 0 },
      anthropic: { status: 'unconfigured', modelCount: 0 },
      openai: { status: 'unconfigured', modelCount: 0 },
      xai: { status: 'unconfigured', modelCount: 0 },
      mistral: { status: 'unconfigured', modelCount: 0 },
      deepseek: { status: 'unconfigured', modelCount: 0 },
      openrouter: { status: 'unconfigured', modelCount: 0 },
      custom: { status: 'unconfigured', modelCount: 0 },
    },
  };

  const tasks: Promise<void>[] = [];

  // 1. OpenAI
  if (config.openaiApiKey) {
    tasks.push(
      fetchOpenAIModels(config.openaiApiKey, timeoutMs)
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
  if (config.geminiApiKey) {
    tasks.push(
      fetchGeminiModels(config.geminiApiKey, timeoutMs)
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
  if (config.anthropicApiKey) {
    tasks.push(
      fetchAnthropicModels(config.anthropicApiKey, timeoutMs)
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

  // 4. xAI
  if (config.xaiApiKey) {
    tasks.push(
      fetchXaiModels(config.xaiApiKey, timeoutMs)
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

  // 5. Mistral
  if (config.mistralApiKey) {
    tasks.push(
      fetchMistralModels(config.mistralApiKey, timeoutMs)
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

  // 6. DeepSeek
  if (config.deepseekApiKey) {
    tasks.push(
      fetchDeepSeekModels(config.deepseekApiKey, timeoutMs)
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

  // 7. OpenRouter
  if (config.openrouterApiKey) {
    tasks.push(
      fetchOpenRouterModels(config.openrouterApiKey, timeoutMs)
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

  // 8. Custom OpenAI-compatible model
  // If all custom variables are added (CUSTOM_API_KEY, CUSTOM_API_MODEL_NAME, CUSTOM_API_URL),
  // the model is listed using the configured model name
  if (config.custom.apiKey && config.custom.modelName && config.custom.baseURL) {
    result.models.push({
      provider: 'custom',
      model_id: config.custom.modelName,
    });
    result.providers.custom = {
      status: 'available',
      modelCount: 1,
    };
  }

  await Promise.all(tasks);

  return result;
}
