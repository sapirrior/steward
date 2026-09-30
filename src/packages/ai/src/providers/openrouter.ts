/**
 * @steward/ai - OpenRouter Provider Definition
 */

import type { Provider } from '../client.js';
import { envApiKeyAuth } from '../auth/api-key.js';
import {
  loginOpenRouter,
  refreshOpenRouter,
  toOpenRouterAuth,
} from '../auth/oauth/openrouter.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';
import { anthropicMessagesProtocol } from '../protocols/anthropic-messages.js';
import { fetchModelsDevCatalog } from '../models/catalog.js';
import type { Model } from '../types.js';

let cachedModels: Model[] = [];

export function openRouterProvider(): Provider {
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModelId: 'anthropic/claude-sonnet-4.5',
    auth: {
      apiKey: envApiKeyAuth(['OPENROUTER_API_KEY']),
      oauth: {
        name: 'OpenRouter',
        login: loginOpenRouter,
        refresh: refreshOpenRouter,
        toAuth: toOpenRouterAuth,
      },
    },
    models: () => cachedModels,
    async fetchModels(_auth, fetchFn) {
      const catalog = await fetchModelsDevCatalog({ fetch: fetchFn });
      const filtered = catalog.filter((m) => m.provider === 'openrouter');
      if (filtered.length > 0) cachedModels = [...filtered];
      return cachedModels;
    },
    streams: {
      'openai-completions': openAICompletionsProtocol,
      'anthropic-messages': anthropicMessagesProtocol,
    },
  };
}
