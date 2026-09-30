import type { ReasoningEffort } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

const EFFORT_HELP = `Reasoning Effort Levels:
  none   : disable reasoning/thinking
  low    : fast, concise reasoning
  medium : balanced reasoning
  high   : thorough reasoning

Usage:
  /effort        - Open effort picker
  /effort <name> - Set effort (none | low | medium | high)`;

export function parseEffort(input?: string): ReasoningEffort | undefined {
  if (!input) return undefined;
  const lower = input.trim().toLowerCase();
  if (lower === 'none' || lower === 'off' || lower === '0') return 'none';
  if (lower === 'low' || lower === '1' || lower === 'minimal') return 'low';
  if (lower === 'medium' || lower === 'med' || lower === '2' || lower === 'default')
    return 'medium';
  if (lower === 'high' || lower === '3' || lower === 'max' || lower === 'xhigh') return 'high';
  return undefined;
}

/**
 * /effort slash command: view or set reasoning/thinking effort level for models.
 */
export const effortCommand: SlashCommand = {
  name: 'effort',
  description: 'View or set model reasoning effort (none, low, medium, high)',
  usage: '/effort [none | low | medium | high]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const currentEffort = context.session.getEffort();

    if (args.length === 0) {
      return {
        handled: true,
        data: { showEffortPicker: true, currentEffort },
      };
    }

    const input = args[0]?.trim();
    const parsed = parseEffort(input);

    if (!parsed) {
      return {
        handled: true,
        message: `Invalid effort level "${input}".\n\n${EFFORT_HELP}`,
      };
    }

    context.session.setEffort(parsed);

    return {
      handled: true,
      message: `Reasoning effort set to "${parsed}".`,
      data: { effort: parsed },
    };
  },
};
