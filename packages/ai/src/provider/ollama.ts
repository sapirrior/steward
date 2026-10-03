/**
 * @steward/ai — Ollama (Local) Provider
 */

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createOllamaLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: OpenAICompatibleProvider = createOpenAICompatible({
    name: 'ollama',
    baseURL: 'http://localhost:11434/v1',
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function ollamaProvider(): Provider {
  return {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModelId: 'llama3.2',
    envVars: [],
    keyless: true,
    authScheme: 'bearer',
    namespace: 'ollama',
    languageModel(modelId, auth, fetchFn) {
      return createOllamaLanguageModel(modelId, auth, fetchFn);
    },
    streams: {},
  };
}
