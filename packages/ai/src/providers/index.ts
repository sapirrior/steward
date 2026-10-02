/**
 * @steward/ai - Built-in Providers Index
 */

import { anthropicProvider } from './anthropic.js';
import { openAIProvider } from './openai.js';
import { googleProvider } from './google.js';
import { openRouterProvider } from './openrouter.js';
import { grokProvider } from './grok.js';
import { mistralProvider } from './mistral.js';
import { githubCopilotProvider } from './github-copilot.js';
import type { Provider } from '../client.js';

export { anthropicProvider } from './anthropic.js';
export { openAIProvider } from './openai.js';
export { googleProvider } from './google.js';
export { openRouterProvider } from './openrouter.js';
export { grokProvider } from './grok.js';
export { mistralProvider } from './mistral.js';
export { githubCopilotProvider } from './github-copilot.js';
export { openAICompatibleProvider } from './openai-compatible.js';

export function builtinProviders(): Provider[] {
  return [
    anthropicProvider(),
    openAIProvider(),
    googleProvider(),
    openRouterProvider(),
    grokProvider(),
    mistralProvider(),
    githubCopilotProvider(),
  ];
}
