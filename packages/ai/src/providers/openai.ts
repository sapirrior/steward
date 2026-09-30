/**
 * @steward/ai - OpenAI Provider Definition
 */

import type { Provider } from '../client.js';
import { openAIResponsesProtocol } from '../protocols/openai-responses.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export function openAIProvider(): Provider {
  return {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-5.4',
    envVars: ['OPENAI_API_KEY'],
    authScheme: 'bearer',
    streams: {
      'openai-responses': openAIResponsesProtocol,
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
