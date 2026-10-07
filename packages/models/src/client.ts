/**
 * @steward/models - Client Factory & In-Memory Store
 */

import { fetchAndParseModels, DEFAULT_MODELS_DEV_URL } from './source.js';
import type { CreateModelsOptions, ListModelsOptions, ModelMetadata, Models } from './types.js';

export function createModels(options?: CreateModelsOptions): Models {
  const fetchFn = options?.fetch ?? fetch;
  const url = options?.url ?? DEFAULT_MODELS_DEV_URL;

  let cache: Map<string, Map<string, ModelMetadata>> | undefined;
  let inFlightPromise: Promise<Map<string, Map<string, ModelMetadata>>> | undefined;

  async function ensureLoaded(): Promise<Map<string, Map<string, ModelMetadata>>> {
    if (cache) {
      return cache;
    }

    if (!inFlightPromise) {
      inFlightPromise = fetchAndParseModels(fetchFn, url)
        .then((loaded) => {
          cache = loaded;
          inFlightPromise = undefined;
          return loaded;
        })
        .catch((err) => {
          inFlightPromise = undefined;
          throw err;
        });
    }

    return inFlightPromise;
  }

  return {
    async list(opts?: ListModelsOptions): Promise<readonly ModelMetadata[]> {
      const data = await ensureLoaded();
      const results: ModelMetadata[] = [];

      const targetProvider = opts?.provider?.toLowerCase().trim();
      const requireTextCapable = Boolean(opts?.textCapable);

      const checkTextCapable = (m: ModelMetadata) => {
        if (!requireTextCapable) return true;
        return m.inputModalities.includes('text') && m.outputModalities.includes('text');
      };

      if (targetProvider) {
        const providerMap = data.get(targetProvider);
        if (providerMap) {
          for (const model of providerMap.values()) {
            if (checkTextCapable(model)) {
              results.push(model);
            }
          }
        }
      } else {
        for (const providerMap of data.values()) {
          for (const model of providerMap.values()) {
            if (checkTextCapable(model)) {
              results.push(model);
            }
          }
        }
      }

      return results;
    },

    async get(provider: string, modelId: string): Promise<ModelMetadata | undefined> {
      if (!provider || !modelId) return undefined;
      const data = await ensureLoaded();
      const providerMap = data.get(provider.toLowerCase().trim());
      return providerMap?.get(modelId);
    },

    async refresh(): Promise<void> {
      cache = undefined;
      inFlightPromise = undefined;
    },
  };
}
