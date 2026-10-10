import { createXai } from '@ai-sdk/xai';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class XaiProvider implements ModelProvider {
  readonly id = 'xai';
  readonly displayName = 'xAI';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'xai';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.XAI_API_KEY;

    const xai = createXai({
      apiKey,
    });

    return xai(ref.modelId);
  }
}
