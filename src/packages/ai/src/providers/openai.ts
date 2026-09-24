/**
 * @steward/ai - OpenAI Provider Adapter (Chat Completions & Responses)
 */

import { streamOpenAICompatible } from './openai-compatible.js';
import type { InferenceRequest, InferenceStream } from '../types.js';
import type { ResolvedAuth } from '../auth/types.js';

export interface OpenAIStreamOptions {
  request: InferenceRequest;
  auth: ResolvedAuth;
}

export function streamOpenAI(options: OpenAIStreamOptions): InferenceStream {
  const { request, auth } = options;
  return streamOpenAICompatible({
    request,
    auth,
    profile: {
      provider: 'custom',
      baseUrl: 'https://api.openai.com/v1',
      supportsReasoning: true,
      reasoningFormat: 'openai',
      apiPath: '/chat/completions',
      requiresApiKey: true,
    },
  });
}
