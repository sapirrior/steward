/**
 * @steward/ai — Custom (OpenAI-Compatible) Provider
 *
 * Configured via environment variables:
 * - CUSTOM_API_URL / CUSTOM_BASE_URL (defaults to http://localhost:8000/v1)
 * - CUSTOM_API_KEY (optional API key; keyless by default for local servers)
 * - CUSTOM_MODEL_NAME / CUSTOM_MODEL_ID / CUSTOM_MODEL (defaults to 'custom')
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Provider } from '../client.js';

export function customProvider(): Provider {
  const baseUrl =
    (typeof process !== 'undefined' &&
      (process.env.CUSTOM_API_URL || process.env.CUSTOM_BASE_URL)) ||
    'http://localhost:8000/v1';

  const defaultModelId =
    (typeof process !== 'undefined' &&
      (process.env.CUSTOM_MODEL_NAME || process.env.CUSTOM_MODEL_ID || process.env.CUSTOM_MODEL)) ||
    'custom';

  return {
    id: 'custom',
    name: 'Custom (OpenAI-Compatible)',
    baseUrl,
    defaultModelId,
    envVars: ['CUSTOM_API_KEY'],
    keyless: true,
    authScheme: 'bearer',
    namespace: 'custom',
    languageModel(modelId, auth, fetchFn) {
      const p = createOpenAICompatible({
        name: 'custom',
        baseURL: baseUrl,
        apiKey:
          auth.apiKey || (typeof process !== 'undefined' ? process.env.CUSTOM_API_KEY : undefined),
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId || defaultModelId);
    },
    streams: {},
  };
}
