/**
 * @steward/ai — Anthropic Provider
 */

import { createAnthropic, type AnthropicProvider } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createAnthropicLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: AnthropicProvider = createAnthropic({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function anthropicProvider(): Provider {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModelId: 'claude-sonnet-4-5',
    envVars: ['ANTHROPIC_API_KEY'],
    authScheme: 'x-api-key',
    namespace: 'anthropic',
    languageModel(modelId, auth, fetchFn) {
      return createAnthropicLanguageModel(modelId, auth, fetchFn);
    },
  };
}
