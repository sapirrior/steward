/**
 * @steward/ai - Anthropic Provider Definition
 */

import type { Provider } from '../client.js';
import { anthropicMessagesProtocol } from '../protocols/anthropic-messages.js';

export function anthropicProvider(): Provider {
  return {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModelId: 'claude-sonnet-4-5',
    envVars: ['ANTHROPIC_API_KEY'],
    authScheme: 'x-api-key',
    streams: {
      'anthropic-messages': anthropicMessagesProtocol,
    },
  };
}
