/**
 * @steward/ai - GitHub Copilot Provider Definition
 */

import type { Provider } from '../client.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';

export const COPILOT_HEADERS = {
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'Editor-Version': 'vscode/1.107.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'Copilot-Integration-Id': 'vscode-chat',
  'Openai-Intent': 'conversation-edits',
  'X-Initiator': 'agent',
} as const;

export function getCopilotBaseUrl(token?: string): string {
  if (!token) return 'https://api.individual.githubcopilot.com';
  const match = token.match(/proxy-ep=([^;]+)/);
  if (!match || !match[1]) return 'https://api.individual.githubcopilot.com';
  const proxyHost = match[1];
  const apiHost = proxyHost.replace(/^proxy\./, 'api.');
  return `https://${apiHost}`;
}

export function githubCopilotProvider(): Provider {
  return {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    baseUrl: 'https://api.individual.githubcopilot.com',
    defaultModelId: 'gpt-4o',
    envVars: ['GITHUB_TOKEN', 'GH_TOKEN', 'COPILOT_API_KEY'],
    authScheme: 'bearer',
    prepare(_model, _request, auth) {
      const dynamicBaseUrl = getCopilotBaseUrl(auth.apiKey);
      return {
        baseUrl: dynamicBaseUrl,
        headers: { ...COPILOT_HEADERS },
      };
    },
    streams: {
      'openai-completions': openAICompletionsProtocol,
    },
  };
}
