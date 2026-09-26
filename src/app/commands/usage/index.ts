import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * Formats integer numbers with localized comma grouping (e.g. 12,450).
 */
function formatNumber(num: number | undefined): string {
  return (num ?? 0).toLocaleString();
}

/**
 * /usage slash command: displays session token usage metrics and turn statistics.
 */
export const usageCommand: SlashCommand = {
  name: 'usage',
  description: 'Displays token usage metrics and statistics for the current session',
  usage: '/usage',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const sessionData = context.session.session;
    const model = context.session.getModel();
    const usage = context.session.getUsage();
    const turnsCount = sessionData?.turns?.length ?? 0;

    const lines: string[] = [
      `Session Usage & Metrics:`,
      `• Active Model: ${model.modelId} (${model.provider}${model.effort !== 'medium' ? `, effort: ${model.effort}` : ''})`,
      `• Turns Completed: ${formatNumber(turnsCount)}`,
      `• Input Tokens: ${formatNumber(usage.inputTokens)}`,
      `• Output Tokens: ${formatNumber(usage.outputTokens)}`,
    ];

    if (usage.reasoningTokens && usage.reasoningTokens > 0) {
      lines.push(`• Reasoning Tokens: ${formatNumber(usage.reasoningTokens)}`);
    }

    if (usage.cacheReadTokens && usage.cacheReadTokens > 0) {
      lines.push(`• Cache Read Tokens: ${formatNumber(usage.cacheReadTokens)}`);
    }

    if (usage.cacheWriteTokens && usage.cacheWriteTokens > 0) {
      lines.push(`• Cache Write Tokens: ${formatNumber(usage.cacheWriteTokens)}`);
    }

    lines.push(`• Total Tokens: ${formatNumber(usage.totalTokens)}`);

    return {
      handled: true,
      message: lines.join('\n'),
    };
  },
};
