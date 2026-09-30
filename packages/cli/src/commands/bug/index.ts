import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * /bug slash command: displays the issue tracker and feedback URL.
 */
export const bugCommand: SlashCommand = {
  name: 'bug',
  description: 'Report issues or submit feedback to GitHub',
  usage: '/bug',

  async execute(_args: string[], _context: CommandContext): Promise<CommandResult> {
    return {
      handled: true,
      message: 'Report issues or feedback to https://github.com/sapirrior/steward/issues',
    };
  },
};
