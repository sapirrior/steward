/**
 * @steward/ai - Mistral AI Provider Definition
 */

import type { Provider } from '../client.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export function mistralProvider(): Provider {
  return {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModelId: 'mistral-large-latest',
    envVars: ['MISTRAL_API_KEY'],
    authScheme: 'bearer',
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
