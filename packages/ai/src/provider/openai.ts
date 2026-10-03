/**
 * @steward/ai — OpenAI Provider
 */

import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createOpenAILanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: OpenAIProvider = createOpenAI({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p.responses(modelId);
}

export function openAIProvider(): Provider {
  return {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-4o',
    envVars: ['OPENAI_API_KEY'],
    authScheme: 'bearer',
    namespace: 'openai',
    languageModel(modelId, auth, fetchFn) {
      return createOpenAILanguageModel(modelId, auth, fetchFn);
    },
    streams: {},
  };
}
