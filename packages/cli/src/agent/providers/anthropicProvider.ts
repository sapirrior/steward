import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class AnthropicProvider implements ModelProvider {
  readonly id = 'anthropic';
  readonly displayName = 'Anthropic';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'anthropic';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;

    const anthropic = createAnthropic({
      apiKey,
    });

    return anthropic(ref.modelId);
  }
}
