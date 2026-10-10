import { createGroq } from '@ai-sdk/groq';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class GroqProvider implements ModelProvider {
  readonly id = 'groq';
  readonly displayName = 'Groq';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'groq';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey = options?.apiKey || process.env.GROQ_API_KEY;

    const groq = createGroq({
      apiKey,
    });

    return groq(ref.modelId);
  }
}
