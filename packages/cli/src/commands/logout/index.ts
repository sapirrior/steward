import { logout as oauthLogout, logoutAll as oauthLogoutAll, authStatus } from '@steward/oauth';
import { normalizeProviderId } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * /logout slash command: log out of a specific provider or all providers.
 *
 * Usage:
 *   /logout             - Log out of all stored provider credentials
 *   /logout all         - Log out of all stored provider credentials
 *   /logout <provider>  - Log out of a specific provider (e.g. anthropic, openrouter, github-copilot)
 */
export const logoutCommand: SlashCommand = {
  name: 'logout',
  description: 'Log out of all or a specific OAuth/API provider',
  usage: '/logout [provider | all]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const target = args[0]?.trim().toLowerCase();

    if (!target || target === 'all') {
      const clearedCount = await oauthLogoutAll();
      return {
        handled: true,
        message:
          clearedCount > 0
            ? `Logged out of all providers (${clearedCount} credential(s) cleared from ~/steward/auth.json).`
            : 'No stored credentials found in ~/steward/auth.json.',
      };
    }

    const providerId = normalizeProviderId(target) ?? target;
    const removed = await oauthLogout(providerId);

    if (removed) {
      return {
        handled: true,
        message: `Logged out of ${providerId} (credentials cleared from ~/steward/auth.json).`,
      };
    }

    return {
      handled: true,
      message: `No active credentials found for "${providerId}".`,
    };
  },
};
