/**
 * @steward/ai — OpenRouter Provider
 */

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createOpenRouterLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: OpenAICompatibleProvider = createOpenAICompatible({
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function openRouterProvider(): Provider {
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModelId: 'anthropic/claude-sonnet-4-5',
    envVars: ['OPENROUTER_API_KEY'],
    authScheme: 'bearer',
    namespace: 'openrouter',
    languageModel(modelId, auth, fetchFn) {
      return createOpenRouterLanguageModel(modelId, auth, fetchFn);
    },
  };
}
