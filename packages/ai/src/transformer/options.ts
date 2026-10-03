/**
 * @steward/ai — Transformer: Options Normalization
 *
 * Translates Steward InferenceRequest parameters into AI SDK streamText call options.
 * Pure functions, no I/O.
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

  // Temperature: model.temperature is a capability bool; request.temperature is the actual value
  const isReasoningActive = !!request.effort || !!model.reasoning;
  if (model.temperature && (!config.omitTemperatureWithReasoning || !isReasoningActive)) {
    if (request.temperature !== undefined) {
      params.temperature = request.temperature;
    }
  }

  // Reasoning effort mapping (ReasoningEffort = 'none'|'low'|'medium'|'high'|'xhigh')
  if (request.effort) {
    if (request.effort === 'none') {
      params.reasoning = 'none';
    } else if (request.effort === 'low') {
      params.reasoning = 'low';
    } else if (request.effort === 'medium') {
      params.reasoning = 'medium';
    } else if (request.effort === 'high' || request.effort === 'xhigh') {
      params.reasoning = 'high';
    }
  }

  // Merge provider options with requestDefaults
  if (config.requestDefaults.providerOptions) {
    params.providerOptions = { ...(config.requestDefaults.providerOptions as Record<string, unknown>) };
  }

  return params;
}
