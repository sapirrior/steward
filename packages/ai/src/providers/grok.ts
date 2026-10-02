/**
 * @steward/ai - xAI (Grok) Provider Definition
 */

import type { Provider } from '../client.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export function grokProvider(): Provider {
  return {
    id: 'grok',
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    defaultModelId: 'grok-2-latest',
    envVars: ['XAI_API_KEY'],
    authScheme: 'bearer',
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
