/**
 * @steward/ai — Google Gemini Provider
 */

import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export function createGoogleLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const p: GoogleGenerativeAIProvider = createGoogleGenerativeAI({
    apiKey: auth.apiKey,
    headers: auth.headers,
    fetch: fetchFn,
  });
  return p(modelId);
}

export function googleProvider(): Provider {
  return {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModelId: 'gemini-2.5-flash',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    authScheme: 'bearer',
    namespace: 'google',
    languageModel(modelId, auth, fetchFn) {
      return createGoogleLanguageModel(modelId, auth, fetchFn);
    },
    streams: {},
  };
}
