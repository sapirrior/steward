/**
 * @steward/ai — DeepSeek Provider
 */

import { createDeepSeek, type DeepSeekProvider } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createDeepSeekLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: DeepSeekProvider = createDeepSeek({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function deepseekProvider(): Provider {
  return {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModelId: 'deepseek-chat',
    envVars: ['DEEPSEEK_API_KEY'],
    authScheme: 'bearer',
    namespace: 'deepseek',
    languageModel(modelId, auth, fetchFn) {
      return createDeepSeekLanguageModel(modelId, auth, fetchFn);
    },
  };
}
