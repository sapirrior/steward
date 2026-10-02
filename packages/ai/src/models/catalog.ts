/**
 * @steward/ai - Model Catalog & Query Engine
 */

import {
  parseModelsDevModel,
  inferProtocolForModel,
  supportsReasoning,
  type ModelsDevApiResponse,
  type ModelsDevRawModel,
} from './models-dev.js';
import type { Model, ProviderId } from '../types.js';

export {
  parseModelsDevModel,
  inferProtocolForModel,
  supportsReasoning,
  type ModelsDevApiResponse,
  type ModelsDevRawModel,
};

export interface ModelFilter {
  provider?: ProviderId;
  reasoning?: boolean;
  status?: 'alpha' | 'beta' | 'deprecated';
}

/**
 * Filter a list of models using structured criteria.
 */
export function filterModels(
  models: readonly Model[],
  filter?: ModelFilter,
): readonly Model[] {
  if (!filter) return models;

  return models.filter((m) => {
    if (filter.provider && m.provider !== filter.provider) return false;
    if (filter.reasoning !== undefined && m.reasoning !== filter.reasoning) return false;
    if (filter.status !== undefined && m.status !== filter.status) return false;
    return true;
  });
}
