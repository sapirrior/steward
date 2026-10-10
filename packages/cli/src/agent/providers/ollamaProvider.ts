import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama';
  readonly displayName = 'Ollama (Local)';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'ollama';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const baseURL = options?.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    const apiKey = options?.apiKey || process.env.OLLAMA_API_KEY || 'ollama';

    const ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL,
      apiKey,
    });

    return ollama(ref.modelId);
  }
}
