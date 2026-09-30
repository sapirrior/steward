/**
 * @steward/ai - Google Generative AI Provider Definition
 */

import type { Provider } from '../client.js';
import { googleGenerativeAIProtocol } from '../protocols/google-generative-ai.js';

export function googleProvider(): Provider {
  return {
    id: 'google',
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    defaultModelId: 'gemini-3.5-flash',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    authScheme: 'x-goog-api-key',
    streams: {
      'google-generative-ai': googleGenerativeAIProtocol,
    },
  };
}
