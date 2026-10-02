import {
  login as oauthLogin,
  authStatus as oauthAuthStatus,
  type LoginResult,
} from '@steward/oauth';
import { normalizeProviderId } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';
import type { OAuthProviderItem } from '../../ui/components/docks/LoginPicker.js';

const OAUTH_PROVIDERS: { id: string; name: string; description: string }[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Authenticate via Anthropic Console OAuth',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Authenticate with PKCE to access all OpenRouter models',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'Authenticate with Device Code to access Copilot models',
  },
];

/**
 * Executes login flow for a specific provider with UI callbacks.
 */
export async function performLogin(
  providerId: string,
  callbacks?: {
    onDeviceCode?: (info: { userCode: string; verificationUri: string }) => void;
    onAuthUrl?: (url: string) => void;
  },
): Promise<string> {
  const result: LoginResult = await oauthLogin(providerId, {
    onDeviceCode: (info) => {
      callbacks?.onDeviceCode?.(info);
    },
    onAuthUrl: (url) => {
      callbacks?.onAuthUrl?.(url);
    },
  });

  if (result.success) {
    const acct = result.account ? ` (${result.account})` : '';
    return `Successfully logged in to ${result.provider}${acct}! Credentials stored in ~/steward/auth.json.`;
  }
  return `Login failed for ${providerId}: ${result.error || 'Unknown error'}`;
}

/**
 * /login slash command: interactive OAuth provider picker or direct provider login.
 *
 * Usage:
 *   /login             - Open interactive OAuth provider picker dock
 *   /login <provider>  - Login directly with provider (anthropic | openrouter | github-copilot)
 */
export const loginCommand: SlashCommand = {
  name: 'login',
  description: 'Log in to AI model providers with OAuth / Device flow',
  usage: '/login [anthropic | openrouter | github-copilot]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const target = args[0]?.trim().toLowerCase();

    // 1. Direct login if provider supplied
    if (target) {
      const providerId = normalizeProviderId(target) ?? target;
      const message = await performLogin(providerId);
      return {
        handled: true,
        message,
      };
    }

    // 2. Interactive dock picker
    const status = await oauthAuthStatus();
    const items: OAuthProviderItem[] = OAUTH_PROVIDERS.map((p) => {
      const pStatus = status[p.id];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        status: pStatus?.loggedIn ? 'connected' : 'disconnected',
        account: pStatus?.account,
      };
    });

    return {
      handled: true,
      data: {
        showLoginPicker: true,
        providers: items,
        onSelect: async (
          item: OAuthProviderItem,
          callbacks?: {
            onDeviceCode?: (info: { userCode: string; verificationUri: string }) => void;
            onAuthUrl?: (url: string) => void;
          },
        ) => {
          return performLogin(item.id, callbacks);
        },
      },
    };
  },
};
