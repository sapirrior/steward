/**
 * @steward/ai - Built-in Providers Index
 */

import { anthropicProvider } from './anthropic.js';
import { openAIProvider } from './openai.js';
import { googleProvider } from './google.js';
import { openRouterProvider } from './openrouter.js';
import type { Provider } from '../client.js';

export { anthropicProvider } from './anthropic.js';
export { openAIProvider } from './openai.js';
export { googleProvider } from './google.js';
export { openRouterProvider } from './openrouter.js';
export { openAICompatibleProvider } from './openai-compatible.js';

export function builtinProviders(): Provider[] {
  return [
    anthropicProvider(),
    openAIProvider(),
    googleProvider(),
    openRouterProvider(),
  ];
}
