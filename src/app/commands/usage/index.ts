import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * Formats integer numbers with localized comma grouping (e.g. 12,450).
 */
function formatNumber(num: number | undefined): string {
  return (num ?? 0).toLocaleString();
}

/**
 * Formats elapsed duration from ISO timestamp into human-readable string (e.g. "14m 32s").
 */
function formatDuration(isoDateString?: string): string {
  if (!isoDateString) return '0s';
  const start = new Date(isoDateString).getTime();
  if (isNaN(start)) return '0s';
  const elapsedSec = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const hrs = Math.floor(elapsedSec / 3600);
  const mins = Math.floor((elapsedSec % 3600) / 60);
  const secs = elapsedSec % 60;

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Resolves nominal model context window capacity.
 */
function getContextWindowLimit(modelId: string, provider: string): number {
  const m = modelId.toLowerCase();
  const p = provider.toLowerCase();

  if (p === 'gemini' || m.includes('gemini')) return 1_000_000;
  if (p === 'anthropic' || m.includes('claude')) return 200_000;
  if (m.includes('deepseek')) return 64_000;
  if (m.includes('gpt-4') || m.includes('o1') || m.includes('o3') || m.includes('llama'))
    return 128_000;
  return 128_000;
}

/**
 * Renders a compact ASCII/Unicode progress bar representing context window fill percentage.
 */
function renderProgressBar(current: number, max: number, length = 16): string {
  if (max <= 0) return `[${'░'.repeat(length)}] 0%`;
  const ratio = Math.min(Math.max(current / max, 0), 1);
  const percent = Math.round(ratio * 100);
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

/**
 * Calculates a universally grounded cost estimate based on standard industry token pricing tiers.
 */
function estimateUniversalCost(
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number },
  modelId: string,
  provider: string,
): string {
  const p = provider.toLowerCase();
  const m = modelId.toLowerCase();

  if (p === 'ollama' || m.includes('local')) {
    return '$0.00 USD [Local / Offline]';
  }

  const isLightweight =
    m.includes('flash') ||
    m.includes('mini') ||
    m.includes('haiku') ||
    m.includes('8b') ||
    m.includes('deepseek');

  // Industry benchmark pricing per 1M tokens ($)
  const inputPerMillion = isLightweight ? 0.15 : 3.0;
  const outputPerMillion = isLightweight ? 0.6 : 15.0;
  const cachePerMillion = isLightweight ? 0.075 : 0.3;

  const baseCost = (usage.inputTokens * inputPerMillion) / 1_000_000;
  const outputCost = (usage.outputTokens * outputPerMillion) / 1_000_000;
  const cacheCost = ((usage.cacheReadTokens ?? 0) * cachePerMillion) / 1_000_000;

  const total = baseCost + outputCost + cacheCost;

  if (total === 0) {
    return '$0.00 USD [estimated]';
  }

  const formatted = total < 0.005 ? '< $0.01' : `$${total.toFixed(2)}`;
  return `~${formatted} USD [estimated benchmark]`;
}

/**
 * /usage slash command: displays session token usage metrics, context window fill, and turn statistics.
 */
export const usageCommand: SlashCommand = {
  name: 'usage',
  description: 'Displays token usage metrics and statistics for the current session',
  usage: '/usage',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const sessionData = context.session.session;
    const model = context.session.getModel();
    const usage = context.session.getUsage();
    const turns = sessionData?.turns ?? [];
    const turnsCount = turns.length;

    // Count total tool executions across all turns
    let toolCallsCount = 0;
    for (const turn of turns) {
      if (Array.isArray(turn.messages)) {
        for (const msg of turn.messages) {
          if (msg.role === 'tool') {
            toolCallsCount++;
          } else if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            toolCallsCount += msg.content.filter((c: any) => c?.type === 'tool-call').length;
          }
        }
      }
    }

    const contextLimit = getContextWindowLimit(model.modelId, model.provider);
    const contextBar = renderProgressBar(usage.totalTokens, contextLimit);
    const duration = formatDuration(sessionData?.createdAt);
    const costEstimate = estimateUniversalCost(usage, model.modelId, model.provider);

    const lines: string[] = [
      `Session Usage & Analytics:`,
      `• Active Model: ${model.modelId} (${model.provider}${model.effort !== 'medium' ? `, effort: ${model.effort}` : ''})`,
      `• Session Duration: ${duration}`,
      `• Activity: ${formatNumber(turnsCount)} turns (${formatNumber(toolCallsCount)} tool executions)`,
      `• Context Window: ${contextBar} (${formatNumber(usage.totalTokens)} / ${formatNumber(contextLimit)} tokens)`,
      ``,
      `Token Breakdown:`,
      `• Input Tokens: ${formatNumber(usage.inputTokens)}`,
      `• Output Tokens: ${formatNumber(usage.outputTokens)}`,
    ];

    if (usage.reasoningTokens && usage.reasoningTokens > 0) {
      lines.push(`• Reasoning Tokens: ${formatNumber(usage.reasoningTokens)}`);
    }

    if (usage.cacheReadTokens && usage.cacheReadTokens > 0) {
      const totalIn = (usage.inputTokens || 0) + (usage.cacheReadTokens || 0);
      const hitRate = totalIn > 0 ? Math.round((usage.cacheReadTokens / totalIn) * 100) : 0;
      lines.push(
        `• Cache Read Tokens: ${formatNumber(usage.cacheReadTokens)} (${hitRate}% hit rate)`,
      );
    }

    if (usage.cacheWriteTokens && usage.cacheWriteTokens > 0) {
      lines.push(`• Cache Write Tokens: ${formatNumber(usage.cacheWriteTokens)}`);
    }

    lines.push(`• Total Tokens: ${formatNumber(usage.totalTokens)}`);
    lines.push(``);
    lines.push(`Estimated Cost:`);
    lines.push(`• Session Spend: ${costEstimate}`);

    return {
      handled: true,
      message: lines.join('\n'),
    };
  },
};
