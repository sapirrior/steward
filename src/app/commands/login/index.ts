import type { ProviderId } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * /login slash command: opens interactive browser OAuth login flow
 */
export const loginCommand: SlashCommand = {
  name: 'login',
  description:
    'Authenticate with frontier providers via OAuth (Anthropic, OpenRouter, GitHub Copilot)',
  usage: '/login [anthropic | openrouter | github-copilot]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    if (context.session.isBusy) {
      return {
        handled: true,
        message: 'Cannot start login while agent is processing. Please wait or abort first.',
      };
    }

    if (args.length === 0) {
      return {
        handled: true,
        data: { showLoginDock: true },
      };
    }

    const raw = args[0].trim().toLowerCase();
    const providerArg: ProviderId =
      raw === 'copilot' || raw === 'github-copilot' ? 'github-copilot' : (raw as ProviderId);

    if (
      providerArg !== 'anthropic' &&
      providerArg !== 'openrouter' &&
      providerArg !== 'github-copilot'
    ) {
      return {
        handled: true,
        message: `No OAuth login is available for "${raw}".\nSupported OAuth providers: anthropic, openrouter, github-copilot.`,
      };
    }

    return {
      handled: true,
      data: { showLoginDock: true, targetProvider: providerArg },
    };
  },
};
