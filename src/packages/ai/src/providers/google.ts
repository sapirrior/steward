/**
 * @steward/ai - Google Generative AI Provider Definition
 */

import type { Provider } from '../client.js';
import { envApiKeyAuth } from '../auth/api-key.js';
import { googleGenerativeAIProtocol } from '../protocols/google-generative-ai.js';
import { fetchModelsDevCatalog } from '../models/catalog.js';
import type { Model } from '../types.js';

let cachedModels: Model[] = [];

export function googleProvider(): Provider {
  return {
    id: 'google',
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModelId: 'gemini-3.5-flash',
    auth: {
      apiKey: envApiKeyAuth(['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY']),
    },
    models: () => cachedModels,
    async fetchModels(_auth, fetchFn) {
      const catalog = await fetchModelsDevCatalog({ fetch: fetchFn });
      const filtered = catalog.filter((m) => m.provider === 'google');
      if (filtered.length > 0) cachedModels = [...filtered];
      return cachedModels;
    },
    streams: {
      'google-generative-ai': googleGenerativeAIProtocol,
    },
  };
}
