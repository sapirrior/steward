/**
 * @steward/ai — Groq Provider
 */

import { createGroq, type GroqProvider } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createGroqLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: GroqProvider = createGroq({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function groqProvider(): Provider {
  return {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModelId: 'llama-3.3-70b-versatile',
    envVars: ['GROQ_API_KEY'],
    authScheme: 'bearer',
    namespace: 'groq',
    languageModel(modelId, auth, fetchFn) {
      return createGroqLanguageModel(modelId, auth, fetchFn);
    },
    streams: {},
  };
}
