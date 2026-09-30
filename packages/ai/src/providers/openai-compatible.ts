/**
 * @steward/ai - OpenAI-Compatible Provider Factory
 *
 * Use this factory to create custom providers for:
 * - Local servers (Ollama, LM Studio, vLLM, llama.cpp, LocalAI)
 * - Hosted providers (DeepSeek, Groq, xAI, Mistral, Together, Together AI)
 * - Enterprise OpenAI Proxies / Azure OpenAI
 */

import type { Provider } from '../client.js';
import type { Model, ProtocolCompat } from '../types.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export interface OpenAICompatibleProviderOptions {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  envVars?: readonly string[];
  keyless?: boolean;
  models?: readonly Model[];
  compat?: ProtocolCompat;
  defaultModelId?: string;
}

export function openAICompatibleProvider(options: OpenAICompatibleProviderOptions): Provider {
  const { id, name, baseUrl, envVars = [], keyless = false, defaultModelId } = options;

  return {
    id,
    name,
    baseUrl,
    defaultModelId,
    envVars,
    keyless,
    authScheme: 'bearer',
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
