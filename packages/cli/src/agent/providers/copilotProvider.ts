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
    let token = options?.apiKey;

    if (!token) {
      const storedToken = await getToken('github-copilot', options?.signal);
      if (storedToken) {
        token = storedToken;
      }
    }

    let baseURL = 'https://api.individual.githubcopilot.com';
    if (token && token.includes('proxy-ep=')) {
      const match = token.match(/proxy-ep=([^;]+)/);
      if (match?.[1]) {
        baseURL = `https://${match[1]}`;
      }
    }

    const copilot = createOpenAICompatible({
      name: 'github-copilot',
      baseURL,
      apiKey: token,
      headers: {
        'User-Agent': 'GitHubCopilotChat/0.35.0',
        'Editor-Version': 'vscode/1.107.0',
        'Editor-Plugin-Version': 'copilot-chat/0.35.0',
        'Copilot-Integration-Id': 'vscode-chat',
      },
    });

    return copilot(ref.modelId);
  }
}
