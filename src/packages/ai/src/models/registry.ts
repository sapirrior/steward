/**
 * @steward/ai - Model Registry & Provider Descriptors
 */

import type { ProviderId } from '../types.js';

export type WireProtocol =
  'openai-responses' | 'openai-chat' | 'anthropic-messages' | 'gemini' | 'openai-compatible';

export interface ProviderDescriptor {
  id: ProviderId;
  name: string;
  supportsOAuth: boolean;
  defaultModel: string;
  protocol: WireProtocol;
  envVar: string;
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDescriptor> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    supportsOAuth: false,
    defaultModel: 'gemini-2.5-flash',
    protocol: 'gemini',
    envVar: 'GEMINI_API_KEY',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    supportsOAuth: true,
    defaultModel: 'claude-3-7-sonnet-20250219',
    protocol: 'anthropic-messages',
    envVar: 'ANTHROPIC_API_KEY',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    supportsOAuth: false,
    defaultModel: 'gpt-4o-mini',
    protocol: 'openai-chat',
    envVar: 'OPENAI_API_KEY',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    supportsOAuth: false,
    defaultModel: 'deepseek-chat',
    protocol: 'openai-compatible',
    envVar: 'DEEPSEEK_API_KEY',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    supportsOAuth: true,
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    protocol: 'openai-compatible',
    envVar: 'OPENROUTER_API_KEY',
  },
  'github-copilot': {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    supportsOAuth: true,
    defaultModel: 'gpt-4o',
    protocol: 'openai-compatible',
    envVar: 'COPILOT_GITHUB_TOKEN',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    supportsOAuth: false,
    defaultModel: 'llama-3.3-70b-versatile',
    protocol: 'openai-compatible',
    envVar: 'GROQ_API_KEY',
  },
  xai: {
    id: 'xai',
    name: 'xAI / Grok',
    supportsOAuth: false,
    defaultModel: 'grok-2-1212',
    protocol: 'openai-compatible',
    envVar: 'XAI_API_KEY',
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    supportsOAuth: false,
    defaultModel: 'codestral-latest',
    protocol: 'openai-compatible',
    envVar: 'MISTRAL_API_KEY',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    supportsOAuth: false,
    defaultModel: 'qwen2.5-coder:latest',
    protocol: 'openai-compatible',
    envVar: 'OLLAMA_BASE_URL (default: http://localhost:11434/v1)',
  },
  custom: {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    supportsOAuth: false,
    defaultModel: 'default',
    protocol: 'openai-compatible',
    envVar: 'CUSTOM_API_URL / CUSTOM_API_KEY',
  },
};

export function getProviderDescriptor(provider: ProviderId): ProviderDescriptor {
  const descriptor = PROVIDER_REGISTRY[provider];
  if (!descriptor) {
    throw new Error(`Unsupported provider: "${provider}"`);
  }
  return descriptor;
}
