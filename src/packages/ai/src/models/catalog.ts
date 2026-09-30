/**
 * @steward/ai - Dynamic Model Catalog from models.dev with In-Memory Caching
 */

import type { BuiltinProviderId, Model, ProtocolId, ProviderId, ReasoningEffort } from '../types.js';

export interface ModelsDevModel {
  id: string;
  name: string;
  description?: string;
  reasoning?: boolean;
  reasoning_options?: Array<
    | { type: 'effort'; values: Array<string | null> }
    | { type: 'budget_tokens'; min?: number; max?: number }
    | { type: 'toggle' }
  >;
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  status?: string; // 'deprecated' | 'beta' | undefined
  limit?: {
    context?: number;
    output?: number;
  };
  cost?: {
    input?: number;
    output?: number;
    cache_read?: number;
    cache_write?: number;
  };
  modalities?: {
    input?: string[];
    output?: string[];
  };
}

export type ModelsDevResponse = Record<string, { models?: Record<string, ModelsDevModel> }>;

export interface CatalogCacheEntry {
  models: readonly Model[];
  fetchedAt: number;
  etag?: string;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour cache
let inMemoryCatalogCache: CatalogCacheEntry | undefined;

/**
 * Maps models.dev provider key to Steward ProviderId
 */
function normalizeProviderId(raw: string): ProviderId | undefined {
  if (raw === 'anthropic') return 'anthropic';
  if (raw === 'openai') return 'openai';
  if (raw === 'google') return 'google';
  if (raw === 'github-copilot') return 'github-copilot';
  if (raw === 'openrouter') return 'openrouter';
  return undefined;
}

/**
 * Infer wire protocol for a model based on provider and model ID conventions
 */
export function inferProtocolForModel(providerId: ProviderId, modelId: string): ProtocolId {
  if (providerId === 'anthropic') return 'anthropic-messages';
  if (providerId === 'google') return 'google-generative-ai';

  if (providerId === 'github-copilot') {
    if (/^claude-(haiku|sonnet|opus|fable)/i.test(modelId)) {
      return 'anthropic-messages';
    }
    if (/^(gpt-|grok-|oswe|mai-)/i.test(modelId)) {
      return 'openai-responses';
    }
    return 'openai-completions';
  }

  if (providerId === 'openai') {
    // Modern OpenAI default is openai-responses, completions as fallback
    return 'openai-responses';
  }

  return 'openai-completions';
}

/**
 * Extracts a thinking level map from models.dev reasoning_options
 */
function buildThinkingLevelMap(options?: ModelsDevModel['reasoning_options']): Model['thinkingLevelMap'] {
  if (!options || options.length === 0) return undefined;

  const effortOpt = options.find((o) => o.type === 'effort');
  if (effortOpt && 'values' in effortOpt) {
    const vals = new Set(effortOpt.values);
    const map: Partial<Record<ReasoningEffort, string | null>> = {
      none: vals.has('none') ? 'none' : null,
      low: vals.has('low') ? 'low' : null,
      medium: vals.has('medium') ? 'medium' : null,
      high: vals.has('high') ? 'high' : null,
      xhigh: vals.has('xhigh') ? 'xhigh' : null,
    };
    return map;
  }

  const budgetOpt = options.find((o) => o.type === 'budget_tokens');
  if (budgetOpt) {
    // Budget tokens model supports all standard effort levels
    return {
      none: 'none',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'xhigh',
    };
  }

  return undefined;
}

/**
 * Converts a raw models.dev item into a normalized Steward Model object.
 */
export function parseModelsDevItem(providerId: ProviderId, raw: ModelsDevModel): Model | undefined {
  // 1. Filter out deprecated models
  if (raw.status === 'deprecated') return undefined;

  // 2. Filter out models that do not support tool calling (coding agent requirement)
  if (raw.tool_call !== true) return undefined;

  // 3. Filter out non-text models (e.g. image-only, audio-only, embedding models)
  if (raw.modalities?.input && !raw.modalities.input.includes('text')) {
    return undefined;
  }

  const protocol = inferProtocolForModel(providerId, raw.id);
  const reasoning = Boolean(raw.reasoning || (raw.reasoning_options && raw.reasoning_options.length > 0));
  const thinkingLevelMap = buildThinkingLevelMap(raw.reasoning_options);

  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: providerId,
    protocol,
    baseUrl: '',
    reasoning,
    thinkingLevelMap,
    contextWindow: raw.limit?.context,
    maxOutputTokens: raw.limit?.output ?? 4096,
    cost: raw.cost
      ? {
          input: raw.cost.input ?? 0,
          output: raw.cost.output ?? 0,
          cacheRead: raw.cost.cache_read,
          cacheWrite: raw.cost.cache_write,
        }
      : undefined,
  };
}

/**
 * Fetches and parses the latest models from models.dev with in-memory caching.
 */
export async function fetchModelsDevCatalog(options?: {
  fetch?: typeof fetch;
  forceRefresh?: boolean;
  ttlMs?: number;
}): Promise<readonly Model[]> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();

  if (!options?.forceRefresh && inMemoryCatalogCache && now - inMemoryCatalogCache.fetchedAt < ttl) {
    return inMemoryCatalogCache.models;
  }

  const fetchFn = options?.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (inMemoryCatalogCache?.etag) {
    headers['If-None-Match'] = inMemoryCatalogCache.etag;
  }

  try {
    const res = await fetchFn('https://models.dev/api.json', {
      method: 'GET',
      headers,
    });

    if (res.status === 304 && inMemoryCatalogCache) {
      inMemoryCatalogCache.fetchedAt = now;
      return inMemoryCatalogCache.models;
    }

    if (!res.ok) {
      return inMemoryCatalogCache?.models ?? [];
    }

    const etag = res.headers.get('etag') ?? undefined;
    const data = (await res.json()) as ModelsDevResponse;
    const models: Model[] = [];

    for (const [rawProviderKey, providerData] of Object.entries(data)) {
      const providerId = normalizeProviderId(rawProviderKey);
      if (!providerId || !providerData.models) continue;

      for (const rawModel of Object.values(providerData.models)) {
        const parsed = parseModelsDevItem(providerId, rawModel);
        if (parsed) {
          models.push(parsed);
        }
      }
    }

    inMemoryCatalogCache = {
      models,
      fetchedAt: now,
      etag,
    };

    return models;
  } catch {
    return inMemoryCatalogCache?.models ?? [];
  }
}

/** Reset cache for unit testing */
export function clearModelsDevCache(): void {
  inMemoryCatalogCache = undefined;
}
