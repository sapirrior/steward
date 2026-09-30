/**
 * @steward/ai - GitHub Copilot Provider Definition
 */

import type { Provider } from '../client.js';
import { envApiKeyAuth } from '../auth/api-key.js';
import {
  loginGitHubCopilot,
  refreshGitHubCopilot,
  toGitHubCopilotAuth,
} from '../auth/oauth/github-copilot.js';
import { anthropicMessagesProtocol } from '../protocols/anthropic-messages.js';
import { openAIResponsesProtocol } from '../protocols/openai-responses.js';
import { openAICompletionsProtocol } from '../protocols/openai-completions.js';
import { fetchModelsDevCatalog } from '../models/catalog.js';
import type { Model } from '../types.js';

let cachedModels: Model[] = [];

export function githubCopilotProvider(): Provider {
  return {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    baseUrl: 'https://api.individual.githubcopilot.com',
    defaultModelId: 'claude-sonnet-4-5',
    auth: {
      apiKey: envApiKeyAuth(['COPILOT_GITHUB_TOKEN']),
      oauth: {
        name: 'GitHub Copilot',
        login: loginGitHubCopilot,
        refresh: refreshGitHubCopilot,
        toAuth: toGitHubCopilotAuth,
      },
    },
    models: () => cachedModels,
    async fetchModels(_auth, fetchFn) {
      const catalog = await fetchModelsDevCatalog({ fetch: fetchFn });
      const filtered = catalog.filter((m) => m.provider === 'github-copilot');
      if (filtered.length > 0) cachedModels = [...filtered];
      return cachedModels;
    },
    streams: {
      'anthropic-messages': anthropicMessagesProtocol,
      'openai-responses': openAIResponsesProtocol,
      'openai-completions': openAICompletionsProtocol,
    },
    prepare(model, request, auth) {
      // Dynamic X-Initiator inferred from last message role
      const lastMsg = request.messages[request.messages.length - 1];
      const initiator = lastMsg?.role === 'tool' ? 'agent' : 'user';
      return {
        headers: {
          'X-Initiator': initiator,
        },
      };
    },
  };
}
