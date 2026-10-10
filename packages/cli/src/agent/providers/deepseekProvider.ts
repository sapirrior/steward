import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class DeepSeekProvider implements ModelProvider {
  readonly id = 'deepseek';
  readonly displayName = 'DeepSeek';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'deepseek';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY;

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(ref.modelId);
  }
}
