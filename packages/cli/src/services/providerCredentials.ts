import { getToken } from '@steward/oauth';
import type { ProviderKeyMetadata } from '@steward/sdk';

export interface ResolveCredentialsOptions {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Resolves API keys, base URLs, and headers for the CLI environment.
 * Priority order:
 * 1. Explicit caller options
 * 2. OAuth tokens (for OpenRouter / GitHub Copilot)
 * 3. Standard environment variables
 */
export async function resolveCliCredentials(
  provider: string,
  options?: ResolveCredentialsOptions,
): Promise<ProviderKeyMetadata> {
  const normProvider = provider.toLowerCase();

  switch (normProvider) {
    case 'anthropic': {
      const apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'openai': {
      const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'google':
    case 'gemini': {
      const apiKey =
        options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'openrouter': {
      let apiKey = options?.apiKey;
      if (!apiKey) {
        try {
          const storedToken = await getToken('openrouter', options?.signal);
          if (storedToken) {
            apiKey = storedToken;
          }
        } catch {
          // Fall back to environment variable
        }
      }
      if (!apiKey) {
        apiKey = process.env.OPENROUTER_API_KEY;
      }
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'github-copilot':
    case 'copilot': {
      let apiKey = options?.apiKey;
      if (!apiKey) {
        try {
          const storedToken = await getToken('github-copilot', options?.signal);
          if (storedToken) {
            apiKey = storedToken;
          }
        } catch {
          // Fall back to empty or options
        }
      }
      const baseURL =
        options?.baseURL || process.env.COPILOT_BASE_URL || process.env.GITHUB_COPILOT_BASE_URL;
      return { apiKey, baseURL, headers: options?.headers };
    }

    case 'deepseek': {
      const apiKey = options?.apiKey || process.env.DEEPSEEK_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'mistral': {
      const apiKey = options?.apiKey || process.env.MISTRAL_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'groq': {
      const apiKey = options?.apiKey || process.env.GROQ_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'xai': {
      const apiKey = options?.apiKey || process.env.XAI_API_KEY;
      return { apiKey, baseURL: options?.baseURL, headers: options?.headers };
    }

    case 'ollama': {
      const baseURL = options?.baseURL || process.env.OLLAMA_BASE_URL;
      const apiKey = options?.apiKey || process.env.OLLAMA_API_KEY;
      return { apiKey, baseURL, headers: options?.headers };
    }

    case 'custom': {
      const baseURL =
        options?.baseURL || process.env.CUSTOM_BASE_URL || process.env.OPENAI_BASE_URL;
      const apiKey = options?.apiKey || process.env.CUSTOM_API_KEY || process.env.OPENAI_API_KEY;
      return { apiKey, baseURL, headers: options?.headers };
    }

    default:
      return {
        apiKey: options?.apiKey,
        baseURL: options?.baseURL,
        headers: options?.headers,
      };
  }
}
