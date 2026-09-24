/**
 * @steward/ai - Auth Manager
 */

import type { ProviderId } from '../types.js';
import type {
  AuthInteraction,
  AuthStatus,
  CredentialInfo,
  CredentialStore,
  OAuthCredential,
  ResolvedAuth,
} from './types.js';
import { AuthResolver, type StaticApiKeyProvider } from './resolver.js';
import { loginAnthropic } from './oauth/anthropic.js';
import { loginOpenRouter } from './oauth/openrouter.js';
import { loginGitHubCopilot } from './oauth/github-copilot.js';
import { createFileCredentialStore } from './store.js';
import { AIError } from '../errors.js';

export interface AuthManagerOptions {
  store?: CredentialStore;
  staticKeys?: StaticApiKeyProvider;
  refreshMarginMs?: number;
}

export interface AuthManager {
  resolve(provider: ProviderId, signal?: AbortSignal): Promise<ResolvedAuth | undefined>;
  login(provider: ProviderId, interaction: AuthInteraction): Promise<OAuthCredential>;
  logout(provider: ProviderId): Promise<void>;
  list(): Promise<readonly CredentialInfo[]>;
  getStatus(provider: ProviderId): Promise<AuthStatus>;
}

export class DefaultAuthManager implements AuthManager {
  private readonly store: CredentialStore;
  private readonly resolver: AuthResolver;
  private readonly staticKeys?: StaticApiKeyProvider;

  constructor(options?: AuthManagerOptions) {
    this.store = options?.store ?? createFileCredentialStore();
    this.staticKeys = options?.staticKeys ?? {
      getApiKey: (provider: ProviderId) => {
        switch (provider) {
          case 'openai':
            return process.env.OPENAI_API_KEY;
          case 'gemini':
            return process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
          case 'anthropic':
            return process.env.ANTHROPIC_API_KEY;
          case 'deepseek':
            return process.env.DEEPSEEK_API_KEY;
          case 'openrouter':
            return process.env.OPENROUTER_API_KEY;
          case 'github-copilot':
            return process.env.COPILOT_GITHUB_TOKEN;
          case 'groq':
            return process.env.GROQ_API_KEY;
          case 'xai':
            return process.env.XAI_API_KEY;
          case 'mistral':
            return process.env.MISTRAL_API_KEY || process.env.CODESTRAL_API_KEY;
          case 'ollama':
            return 'none';
          case 'custom':
            return process.env.CUSTOM_API_KEY || 'none';
          default:
            return undefined;
        }
      },
    };
    this.resolver = new AuthResolver({
      store: this.store,
      staticKeys: this.staticKeys,
      refreshMarginMs: options?.refreshMarginMs,
    });
  }

  public async resolve(
    provider: ProviderId,
    signal?: AbortSignal,
  ): Promise<ResolvedAuth | undefined> {
    return await this.resolver.resolve(provider, signal);
  }

  public async login(provider: ProviderId, interaction: AuthInteraction): Promise<OAuthCredential> {
    let credential: OAuthCredential;

    if (provider === 'anthropic') {
      credential = await loginAnthropic(interaction);
    } else if (provider === 'openrouter') {
      credential = await loginOpenRouter(interaction);
    } else if (provider === 'github-copilot') {
      credential = await loginGitHubCopilot(interaction);
    } else {
      throw new AIError(`No browser OAuth login is available for "${provider}".`, {
        code: 'oauth',
        provider,
      });
    }

    // Persist replacement credential atomically
    await this.store.modify(provider, async () => credential);

    return credential;
  }

  public async logout(provider: ProviderId): Promise<void> {
    await this.store.delete(provider);
  }

  public async list(): Promise<readonly CredentialInfo[]> {
    return await this.store.list();
  }

  public async getStatus(provider: ProviderId): Promise<AuthStatus> {
    const cred = await this.store.read(provider);
    if (cred) {
      return {
        provider,
        configured: true,
        source: 'oauth',
        expiresAt: cred.expiresAt,
      };
    }

    const staticKey = this.staticKeys?.getApiKey(provider);
    if (staticKey) {
      return {
        provider,
        configured: true,
        source: provider === 'custom' ? 'custom' : 'api-key',
      };
    }

    return {
      provider,
      configured: false,
    };
  }
}

export function createAuthManager(options?: AuthManagerOptions): AuthManager {
  return new DefaultAuthManager(options);
}
