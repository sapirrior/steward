import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';
import { getToken } from '@steward/oauth';
import type { ModelProvider, ResolveModelOptions } from './ModelProvider.js';

export class CopilotProvider implements ModelProvider {
  readonly id = 'github-copilot';
  readonly displayName = 'GitHub Copilot';

  canHandle(ref: ModelRef): boolean {
    const p = ref.provider.toLowerCase();
    return p === 'github-copilot' || p === 'copilot';
  }

  async resolveModel(ref: ModelRef, options?: ResolveModelOptions): Promise<LanguageModel> {
    // 1. Prioritize stored OAuth token from @steward/oauth, fallback to options.apiKey
    const storedToken = await getToken('github-copilot', options?.signal);
    const token = storedToken || options?.apiKey;

    const baseURL =
      options?.baseURL ||
      process.env.COPILOT_BASE_URL ||
      process.env.GITHUB_COPILOT_BASE_URL ||
      'https://api.individual.githubcopilot.com';

    const copilot = createOpenAICompatible({
      name: 'github-copilot',
      baseURL,
      apiKey: token,
      headers: {
        'User-Agent': 'GitHubCopilotChat/0.35.0',
        'Editor-Version': 'vscode/1.107.0',
        'Editor-Plugin-Version': 'copilot-chat/0.35.0',
        'Copilot-Integration-Id': 'vscode-chat',
        'Openai-Organization': 'github-copilot',
        'Openai-Intent': 'conversation-panel',
        'X-Github-Api-Version': '2023-07-07',
      },
    });

    return copilot(ref.modelId);
  }
}
