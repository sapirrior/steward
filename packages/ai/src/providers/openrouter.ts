/**
 * @steward/ai - OpenRouter Provider Definition
 */

import type { Provider } from '../client.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export function openRouterProvider(): Provider {
  return {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModelId: 'anthropic/claude-sonnet-4.5',
    envVars: ['OPENROUTER_API_KEY'],
    authScheme: 'bearer',
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
