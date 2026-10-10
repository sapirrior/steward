import { createMistral } from '@ai-sdk/mistral';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class MistralProvider implements ModelProvider {
  readonly id = 'mistral';
  readonly displayName = 'Mistral';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'mistral';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.MISTRAL_API_KEY;

    const mistral = createMistral({
      apiKey,
    });

    return mistral(ref.modelId);
  }
}
