/**
 * @steward/ai — GitHub Copilot Provider
 */

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { Provider } from '../client.js';
import type { FetchFn, ResolvedAuth } from './definitions.js';

export const COPILOT_DEFAULT_BASE_URL = 'https://api.individual.githubcopilot.com';

export const COPILOT_HEADERS = {
  'Copilot-Integration-Id': 'vscode-chat',
  'Editor-Version': 'vscode/1.99.0',
  'Editor-Plugin-Version': 'copilot-chat/0.35.0',
  'User-Agent': 'GitHubCopilotChat/0.35.0',
  'X-GitHub-Api-Version': '2026-06-01',
} as const;

export function getCopilotBaseUrl(token?: string): string {
  if (!token) return COPILOT_DEFAULT_BASE_URL;

  const match = token.match(/proxy-ep=([^;]+)/);
  if (match && match[1]) {
    const ep = match[1].trim();
    if (ep.startsWith('proxy.')) {
      return `https://api.${ep.slice(6)}`;
    }
    return ep.startsWith('http') ? ep : `https://${ep}`;
  }

  return COPILOT_DEFAULT_BASE_URL;
}

export function createCopilotLanguageModel(
  modelId: string,
  auth: ResolvedAuth,
  fetchFn?: FetchFn,
): LanguageModel {
  const baseURL = getCopilotBaseUrl(auth.apiKey);

  const p: OpenAICompatibleProvider = createOpenAICompatible({
    name: 'github-copilot',
    baseURL,
    apiKey: auth.apiKey,
    headers: {
      ...COPILOT_HEADERS,
      ...auth.headers,
    },
    fetch: fetchFn,
  });

  return p(modelId);
}

export function githubCopilotProvider(): Provider {
  return {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    baseUrl: COPILOT_DEFAULT_BASE_URL,
    defaultModelId: 'gpt-4o',
    envVars: ['GITHUB_TOKEN', 'COPILOT_API_KEY'],
    authScheme: 'bearer',
    namespace: 'github-copilot',
    languageModel(modelId, auth, fetchFn) {
      return createCopilotLanguageModel(modelId, auth, fetchFn);
    },
  };
}
