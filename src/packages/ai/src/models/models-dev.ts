/**
 * @steward/ai - models.dev Schema Parser and Metadata Normalizer
 */

import type {
  Model,
  ProtocolId,
  ProviderId,
  ReasoningEffort,
  ProtocolCompat,
} from '../types.js';

export interface ModelsDevRawModel {
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
  status?: 'alpha' | 'beta' | 'deprecated' | string;
  release_date?: string;
  limit?: {
    context?: number;
    input?: number;
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
  interleaved?: {
    field?: 'reasoning_content' | 'reasoning_details' | (string & {});
  };
}

export interface ModelsDevRawProvider {
  id?: string;
  name?: string;
  npm?: string;
  env?: string[];
  api?: string;
  doc?: string;
  models?: Record<string, ModelsDevRawModel>;
}

export type ModelsDevApiResponse = Record<string, ModelsDevRawProvider>;

/**
 * Infer wire protocol for a model based on provider and model ID conventions.
 */
export function inferProtocolForModel(providerId: ProviderId, modelId: string): ProtocolId {
  if (providerId === 'anthropic' || providerId === 'openrouter') return 'anthropic-messages';
  if (providerId === 'google') return 'google-generative-ai';
  if (providerId === 'openai') return 'openai-responses';
  return 'openai-completions';
}

/**
 * Extracts a thinking level map from models.dev reasoning_options.
 */
export function buildThinkingLevelMap(
  options?: ModelsDevRawModel['reasoning_options'],
): Model['thinkingLevelMap'] {
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
 * Model compatibility flags derivation based on provider and model ID.
 */
export function deriveCompat(providerId: ProviderId, modelId: string): ProtocolCompat | undefined {
  if (providerId === 'openai') {
    // OpenAI o1/o3/gpt-5 reasoning models require max_completion_tokens
    if (/^(o1|o3|gpt-5)/i.test(modelId)) {
      return {
        maxTokensField: 'max_completion_tokens',
        supportsDeveloperRole: true,
        supportsReasoningEffort: true,
      };
    }
    return {
      maxTokensField: 'max_tokens',
      supportsDeveloperRole: true,
    };
  }
  return undefined;
}

/**
 * Converts a raw models.dev item into a normalized Steward Model object.
 * Returns undefined if model does not meet agentic prerequisites (text modality, tools, active status).
 */
export function parseModelsDevModel(
  providerId: ProviderId,
  raw: ModelsDevRawModel,
  providerDef?: { baseUrl?: string; api?: string },
): Model | undefined {
  // 1. Filter out deprecated models
  if (raw.status === 'deprecated') return undefined;

  // 2. Filter out models without tool support (coding agent requirement)
  if (raw.tool_call !== true) return undefined;

  // 3. Filter modalities: must support text
  const inputModalities = (raw.modalities?.input ?? ['text']).filter(
    (m): m is 'text' | 'image' => m === 'text' || m === 'image',
  );
  if (!inputModalities.includes('text')) {
    return undefined;
  }

  // 4. Must have defined context and output limits
  const contextWindow = raw.limit?.context;
  const maxOutputTokens = raw.limit?.output ?? 4096;
  if (!contextWindow || contextWindow <= 0 || maxOutputTokens <= 0) {
    return undefined;
  }

  const protocol = inferProtocolForModel(providerId, raw.id);
  const reasoning = Boolean(raw.reasoning || (raw.reasoning_options && raw.reasoning_options.length > 0));
  const thinkingLevelMap = buildThinkingLevelMap(raw.reasoning_options);

  const baseUrl = providerDef?.api || providerDef?.baseUrl || (
    providerId === 'anthropic'
      ? 'https://api.anthropic.com'
      : providerId === 'openai'
        ? 'https://api.openai.com/v1'
        : providerId === 'google'
          ? 'https://generativelanguage.googleapis.com'
          : providerId === 'openrouter'
            ? 'https://openrouter.ai/api/v1'
            : 'https://api.openai.com/v1'
  );

  const interleavedField = raw.interleaved?.field === 'reasoning_content' || raw.interleaved?.field === 'reasoning_details'
    ? raw.interleaved.field
    : undefined;

  const status = raw.status === 'alpha' || raw.status === 'beta' ? raw.status : undefined;

  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: providerId,
    protocol,
    baseUrl,
    reasoning,
    thinkingLevelMap,
    input: inputModalities,
    contextWindow,
    maxInputTokens: raw.limit?.input,
    maxOutputTokens,
    temperature: raw.temperature ?? true,
    interleavedReasoningField: interleavedField,
    status,
    releaseDate: raw.release_date,
    cost: raw.cost
      ? {
          input: raw.cost.input ?? 0,
          output: raw.cost.output ?? 0,
          cacheRead: raw.cost.cache_read,
          cacheWrite: raw.cost.cache_write,
        }
      : undefined,
    compat: deriveCompat(providerId, raw.id),
  };
}

/** Check if model supports image inputs */
export function supportsImages(model: Model): boolean {
  return model.input.includes('image');
}

/** Check if model supports reasoning */
export function supportsReasoning(model: Model): boolean {
  return model.reasoning;
}
