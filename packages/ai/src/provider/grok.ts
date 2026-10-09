/**
 * @steward/ai — xAI Grok Provider
 */

import { createXai, type XaiProvider } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createGrokLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: XaiProvider = createXai({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function grokProvider(): Provider {
  return {
    id: 'grok',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    defaultModelId: 'grok-3',
    envVars: ['XAI_API_KEY'],
    authScheme: 'bearer',
    namespace: 'xai',
    languageModel(modelId, auth, fetchFn) {
      return createGrokLanguageModel(modelId, auth, fetchFn);
    },
  };
}
