import type { ProviderId } from '@steward/ai';
import { createAuthManager } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * /logout slash command: deletes stored OAuth credentials for a provider
 */
export const logoutCommand: SlashCommand = {
  name: 'logout',
  description:
    'Log out of an OAuth-authenticated provider (removes ~/.steward/auth.json credentials)',
  usage: '/logout [anthropic | openrouter]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (context.session.isBusy) {
      return {
        handled: true,
        message: 'Cannot log out while agent is generating. Please wait or abort first.',
      };
    }

    const auth = createAuthManager();

    if (args.length === 0) {
      const list = await auth.list();
      if (list.length === 0) {
        return {
          handled: true,
          message: 'No active OAuth credentials found in ~/.steward/auth.json.',
        };
      }
      for (const item of list) {
        await auth.logout(item.provider);
      }
      return {
        handled: true,
        message: `Logged out of all stored OAuth sessions (${list.map((l) => l.provider).join(', ')}).`,
      };
    }

    const providerArg = args[0].trim().toLowerCase() as ProviderId;
    if (providerArg !== 'anthropic' && providerArg !== 'openrouter') {
      return {
        handled: true,
        message: `Provider "${providerArg}" does not use OAuth credentials. Only anthropic and openrouter use OAuth storage.`,
      };
    }

    await auth.logout(providerArg);
    const status = await auth.getStatus(providerArg);

    if (status.configured) {
      return {
        handled: true,
        message: `Logged out of ${providerArg} OAuth. Static API key (${status.source}) is now active.`,
      };
    }

    return {
      handled: true,
      message: `Logged out of ${providerArg} OAuth. Provider is now unconfigured.`,
    };
  },
};
