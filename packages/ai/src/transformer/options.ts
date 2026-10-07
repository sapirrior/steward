/**
 * @steward/ai — Transformer: Options Normalization
 *
 * Steward InferenceRequest + Model → AI SDK streamText call params.
 * The only provider-specific logic: Anthropic rejects temperature when reasoning is active.
 */

import type { InferenceRequest, Model } from '../types.js';
import type { NamespaceConfig } from './config.js';

export interface NormalizedCallParams {
  maxOutputTokens?: number;
  temperature?: number;
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  providerOptions?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export function normalizeOptions(
  request: InferenceRequest,
  model: Model,
  config: NamespaceConfig,
): NormalizedCallParams {
  const params: NormalizedCallParams = {
    maxOutputTokens: request.maxTokens ?? model.maxOutputTokens,
    headers: request.headers ? { ...request.headers } : undefined,
  };

  // model.temperature is a capability bool — only pass temperature if supported
  const isReasoningActive = !!request.effort || !!model.reasoning;
  if (model.temperature && (!config.omitTemperatureWithReasoning || !isReasoningActive)) {
    if (request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
  }

  // Directly pass reasoning effort to AI SDK — AI SDK handles level mapping and budget normalization
  if (request.effort) {
    params.reasoning = request.effort;
  }

  // Merge namespace request defaults (e.g. OpenAI store:false)
  if (config.requestDefaults.providerOptions) {
    params.providerOptions = config.requestDefaults.providerOptions as Record<string, unknown>;
  }

  return params;
}
