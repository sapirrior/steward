/**
 * @steward/ai - OpenAI Provider Definition
 */

import type { Provider } from '../client.js';
import { envApiKeyAuth } from '../auth/api-key.js';
import { openAIResponsesProtocol } from '../protocols/openai-responses.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';
import { fetchModelsDevCatalog } from '../models/catalog.js';
import type { Model } from '../types.js';

let cachedModels: Model[] = [];

export function openAIProvider(): Provider {
  return {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-5.4',
    auth: {
      apiKey: envApiKeyAuth(['OPENAI_API_KEY']),
    },
    models: () => cachedModels,
    async fetchModels(_auth, fetchFn) {
      const catalog = await fetchModelsDevCatalog({ fetch: fetchFn });
      const filtered = catalog.filter((m) => m.provider === 'openai');
      if (filtered.length > 0) cachedModels = [...filtered];
      return cachedModels;
    },
    streams: {
      'openai-responses': openAIResponsesProtocol,
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
