/**
 * @steward/ai — Provider Registry Entry Point
 *
 * Re-exports individual provider modules and gathers built-in providers.
 */

import type { Provider } from '../client.js';

export { anthropicProvider, createAnthropicLanguageModel } from './anthropic.js';
export { openAIProvider, createOpenAILanguageModel } from './openai.js';
export { googleProvider, createGoogleLanguageModel } from './google.js';
export { deepseekProvider, createDeepSeekLanguageModel } from './deepseek.js';
export { groqProvider, createGroqLanguageModel } from './groq.js';
export { mistralProvider, createMistralLanguageModel } from './mistral.js';
export { grokProvider, createGrokLanguageModel } from './grok.js';
export { openRouterProvider, createOpenRouterLanguageModel } from './openrouter.js';
export { ollamaProvider, createOllamaLanguageModel } from './ollama.js';
export {
  githubCopilotProvider,
  createCopilotLanguageModel,
  getCopilotBaseUrl,
  COPILOT_HEADERS,
  COPILOT_DEFAULT_BASE_URL,
} from './github-copilot.js';
export { customProvider } from './custom.js';
export {
  openAICompatibleProvider,
  buildOpenAICompatibleModel,
  type OpenAICompatibleProviderOptions,
} from './compatible.js';

import { anthropicProvider } from './anthropic.js';
import { openAIProvider } from './openai.js';
import { googleProvider } from './google.js';
import { deepseekProvider } from './deepseek.js';
import { groqProvider } from './groq.js';
import { mistralProvider } from './mistral.js';
import { grokProvider } from './grok.js';
import { openRouterProvider } from './openrouter.js';
import { ollamaProvider } from './ollama.js';
import { githubCopilotProvider } from './github-copilot.js';
import { customProvider } from './custom.js';

/**
 * Returns instantiated instances of all 11 built-in providers.
 */
export function builtinProviders(): Provider[] {
  return [
    anthropicProvider(),
    openAIProvider(),
    googleProvider(),
    deepseekProvider(),
    groqProvider(),
    mistralProvider(),
    grokProvider(),
    openRouterProvider(),
    ollamaProvider(),
    githubCopilotProvider(),
    customProvider(),
  ];
}
