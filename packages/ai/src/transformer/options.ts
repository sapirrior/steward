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
  reasoning?: 'low' | 'medium' | 'high' | 'none';
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

  // Map Steward ReasoningEffort → SDK reasoning level
  // ('xhigh' is Steward's top tier, maps to SDK 'high')
  const effort = request.effort;
  if (effort === 'none') params.reasoning = 'none';
  else if (effort === 'low') params.reasoning = 'low';
  else if (effort === 'medium') params.reasoning = 'medium';
  else if (effort === 'high' || effort === 'xhigh') params.reasoning = 'high';

  // Merge namespace request defaults (e.g. OpenAI store:false)
  if (config.requestDefaults.providerOptions) {
    params.providerOptions = config.requestDefaults.providerOptions as Record<string, unknown>;
  }

  return params;
}
