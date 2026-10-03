/**
 * @steward/ai — Mistral Provider
 */

import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createMistralLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: MistralProvider = createMistral({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function mistralProvider(): Provider {
  return {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModelId: 'mistral-large-latest',
    envVars: ['MISTRAL_API_KEY'],
    authScheme: 'bearer',
    namespace: 'mistral',
    languageModel(modelId, auth, fetchFn) {
      return createMistralLanguageModel(modelId, auth, fetchFn);
    },
    streams: {},
  };
}
