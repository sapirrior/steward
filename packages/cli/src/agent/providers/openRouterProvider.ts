import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import { getToken } from '@steward/oauth';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class OpenRouterProvider implements ModelProvider {
  readonly id = 'openrouter';
  readonly displayName = 'OpenRouter';

  canHandle(ref: ModelRef): boolean {
    return ref.provider.toLowerCase() === 'openrouter';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    // 1. Prioritize stored OAuth token from @steward/oauth, fallback to options.apiKey or env var
    const storedToken = await getToken('openrouter', options?.signal);
    const apiKey = storedToken || options?.apiKey || process.env.OPENROUTER_API_KEY;

    const openrouter = createOpenAICompatible({
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      headers: {
        'HTTP-Referer': 'https://steward.dev',
        'X-Title': 'Steward CLI',
      },
    });

    return openrouter(ref.modelId);
  }
}
