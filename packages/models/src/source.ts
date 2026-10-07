/**
 * @steward/models - Remote Fetch & Metadata Ingestion
 */

import { type ModelMetadata, type ModelPricing, ModelsError } from './types.js';

export const DEFAULT_MODELS_DEV_URL = 'https://models.dev/api.json';

interface RawCost {
  input?: number;
  output?: number;
  cache_read?: number;
  cache_write?: number;
}

interface RawLimit {
  context?: number;
  input?: number;
  output?: number;
}

interface RawModalities {
  input?: string[];
  output?: string[];
}

interface RawModelEntry {
  id?: string;
  name?: string;
  reasoning?: boolean;
  tool_call?: boolean;
  modalities?: RawModalities;
  limit?: RawLimit;
  cost?: RawCost;
}

interface RawProviderEntry {
  id?: string;
  name?: string;
  models?: Record<string, RawModelEntry>;
}

type RawApiResponse = Record<string, RawProviderEntry>;

function parsePricing(rawCost?: RawCost): ModelPricing | undefined {
  if (!rawCost || typeof rawCost !== 'object') return undefined;
  const pricing: ModelPricing = {};
  if (typeof rawCost.input === 'number') pricing.input = rawCost.input;
  if (typeof rawCost.output === 'number') pricing.output = rawCost.output;
  if (typeof rawCost.cache_read === 'number') pricing.cacheRead = rawCost.cache_read;
  if (typeof rawCost.cache_write === 'number') pricing.cacheWrite = rawCost.cache_write;
  return Object.keys(pricing).length > 0 ? pricing : undefined;
}

export async function fetchAndParseModels(
  fetchFn: typeof fetch = fetch,
  url: string = DEFAULT_MODELS_DEV_URL,
): Promise<Map<string, Map<string, ModelMetadata>>> {
  let response: Response;
  try {
    response = await fetchFn(url);
  } catch (err) {
    throw new ModelsError(
      'network',
      `Failed to fetch model metadata from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      {
        cause: err,
      },
    );
  }

  if (!response.ok) {
    throw new ModelsError(
      'http',
      `HTTP error fetching models metadata: ${response.status} ${response.statusText}`,
      {
        status: response.status,
      },
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    throw new ModelsError('malformed', `Malformed JSON response from ${url}`, {
      cause: err,
    });
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ModelsError('malformed', 'Expected top-level object mapping provider IDs');
  }

  const result = new Map<string, Map<string, ModelMetadata>>();
  const rawData = data as RawApiResponse;

  for (const [providerKey, providerEntry] of Object.entries(rawData)) {
    if (
      !providerEntry ||
      typeof providerEntry !== 'object' ||
      !providerEntry.models ||
      typeof providerEntry.models !== 'object'
    ) {
      continue;
    }

    const providerId = (providerEntry.id || providerKey).toLowerCase();
    let providerMap = result.get(providerId);
    if (!providerMap) {
      providerMap = new Map<string, ModelMetadata>();
      result.set(providerId, providerMap);
    }

    for (const [modelKey, modelEntry] of Object.entries(providerEntry.models)) {
      if (!modelEntry || typeof modelEntry !== 'object') {
        continue;
      }

      const modelId = modelEntry.id || modelKey;
      if (!modelId) continue;

      const inputModalities = Array.isArray(modelEntry.modalities?.input)
        ? modelEntry.modalities!.input.filter((s): s is string => typeof s === 'string')
        : [];
      const outputModalities = Array.isArray(modelEntry.modalities?.output)
        ? modelEntry.modalities!.output.filter((s): s is string => typeof s === 'string')
        : [];

      const metadata: ModelMetadata = {
        provider: providerId,
        id: modelId,
        name: modelEntry.name || modelId,
        reasoning: Boolean(modelEntry.reasoning),
        toolCall: Boolean(modelEntry.tool_call),
        inputModalities,
        outputModalities,
        contextWindow:
          typeof modelEntry.limit?.context === 'number' ? modelEntry.limit.context : undefined,
        maxInputTokens:
          typeof modelEntry.limit?.input === 'number' ? modelEntry.limit.input : undefined,
        maxOutputTokens:
          typeof modelEntry.limit?.output === 'number' ? modelEntry.limit.output : undefined,
        pricing: parsePricing(modelEntry.cost),
      };

      providerMap.set(modelId, metadata);
    }
  }

  return result;
}
