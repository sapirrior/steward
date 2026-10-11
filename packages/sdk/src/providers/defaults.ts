import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createMistral } from '@ai-sdk/mistral';
import { createGroq } from '@ai-sdk/groq';
import { createXai } from '@ai-sdk/xai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { StewardSDKError } from '../errors.js';
import {
  DEFAULT_COPILOT_BASE_URL,
  DEFAULT_COPILOT_HEADERS,
  DEFAULT_OLLAMA_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_HEADERS,
} from '../constants.js';
import type { ProviderAdapter } from './types.js';

function requireApiKey(provider: string, apiKey?: string): string {
  if (!apiKey || apiKey.trim() === '') {
    throw new StewardSDKError({
      kind: 'auth',
      message: `Missing API key for provider '${provider}'. Provide a valid API key in keyMetadata.`,
      retryable: false,
      provider,
    });
  }
  return apiKey.trim();
}

export const defaultAdapters: readonly ProviderAdapter[] = [
  // 1. Anthropic
  {
    id: 'anthropic',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('anthropic', metadata?.apiKey);
      const anthropic = createAnthropic({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return anthropic(modelId);
    },
  },

  // 2. OpenAI
  {
    id: 'openai',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('openai', metadata?.apiKey);
      const openai = createOpenAI({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return openai(modelId);
    },
  },

  // 3. Google (with 'gemini' alias)
  {
    id: 'google',
    aliases: ['gemini'],
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('google', metadata?.apiKey);
      const google = createGoogleGenerativeAI({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return google(modelId);
    },
  },

  // 4. OpenRouter (OpenAI-compatible)
  {
    id: 'openrouter',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('openrouter', metadata?.apiKey);
      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        apiKey,
        baseURL: metadata?.baseURL ?? DEFAULT_OPENROUTER_BASE_URL,
        headers: {
          ...DEFAULT_OPENROUTER_HEADERS,
          ...metadata?.headers,
        },
      });
      return openrouter(modelId);
    },
  },

  // 5. GitHub Copilot (OpenAI-compatible, with 'copilot' alias)
  {
    id: 'github-copilot',
    aliases: ['copilot'],
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('github-copilot', metadata?.apiKey);
      const copilot = createOpenAICompatible({
        name: 'github-copilot',
        apiKey,
        baseURL: metadata?.baseURL ?? DEFAULT_COPILOT_BASE_URL,
        headers: {
          ...DEFAULT_COPILOT_HEADERS,
          ...metadata?.headers,
        },
      });
      return copilot(modelId);
    },
  },

  // 6. DeepSeek
  {
    id: 'deepseek',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('deepseek', metadata?.apiKey);
      const deepseek = createDeepSeek({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return deepseek(modelId);
    },
  },

  // 7. Mistral
  {
    id: 'mistral',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('mistral', metadata?.apiKey);
      const mistral = createMistral({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return mistral(modelId);
    },
  },

  // 8. Groq
  {
    id: 'groq',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('groq', metadata?.apiKey);
      const groq = createGroq({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return groq(modelId);
    },
  },

  // 9. xAI
  {
    id: 'xai',
    createModel(modelId, metadata) {
      const apiKey = requireApiKey('xai', metadata?.apiKey);
      const xai = createXai({
        apiKey,
        baseURL: metadata?.baseURL,
        headers: metadata?.headers,
      });
      return xai(modelId);
    },
  },

  // 10. Ollama (OpenAI-compatible)
  {
    id: 'ollama',
    createModel(modelId, metadata) {
      const ollama = createOpenAICompatible({
        name: 'ollama',
        apiKey: metadata?.apiKey ?? 'ollama',
        baseURL: metadata?.baseURL ?? DEFAULT_OLLAMA_BASE_URL,
        headers: metadata?.headers,
      });
      return ollama(modelId);
    },
  },

  // 11. Custom (OpenAI-compatible, requires explicit baseURL)
  {
    id: 'custom',
    createModel(modelId, metadata) {
      if (!metadata?.baseURL || metadata.baseURL.trim() === '') {
        throw new StewardSDKError({
          kind: 'invalid-input',
          message: "Custom provider requires a valid 'baseURL' in keyMetadata.",
          retryable: false,
          provider: 'custom',
          modelId,
        });
      }
      const custom = createOpenAICompatible({
        name: 'custom',
        apiKey: metadata.apiKey ?? 'custom',
        baseURL: metadata.baseURL.trim(),
        headers: metadata.headers,
      });
      return custom(modelId);
    },
  },
];
