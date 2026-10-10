import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class GoogleProvider implements ModelProvider {
  readonly id = 'google';
  readonly displayName = 'Google Gemini';

  canHandle(ref: ModelRef): boolean {
    const p = ref.provider.toLowerCase();
    return p === 'google' || p === 'gemini';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    const apiKey =
      options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    return google(ref.modelId);
  }
}
