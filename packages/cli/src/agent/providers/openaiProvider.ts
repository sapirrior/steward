import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai';
  readonly displayName = 'OpenAI';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'openai';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;

    const openai = createOpenAI({
      apiKey,
    });

    return openai(ref.modelId);
  }
}
