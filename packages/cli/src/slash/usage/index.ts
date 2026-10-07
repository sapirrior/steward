import { createModels, type ModelMetadata } from '@steward/models';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

const modelsClient = createModels();

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
 * Calculates accurate cost estimate using @steward/models metadata pricing when available,
 * or fallback heuristic benchmarks.
 */
function estimateCost(usage: any, metadata?: ModelMetadata, modelId = '', provider = ''): string {
  const input = usage?.input ?? usage?.inputTokens ?? 0;
  const output = usage?.output ?? usage?.outputTokens ?? 0;
  const cacheRead = usage?.cacheRead ?? usage?.cacheReadTokens ?? 0;

  if (metadata?.pricing) {
    const inputPerMillion = metadata.pricing.input ?? 0;
    const outputPerMillion = metadata.pricing.output ?? 0;
    const cachePerMillion = metadata.pricing.cacheRead ?? 0;

    const baseCost = (input * inputPerMillion) / 1_000_000;
    const outputCost = (output * outputPerMillion) / 1_000_000;
    const cacheCost = (cacheRead * cachePerMillion) / 1_000_000;
    const total = baseCost + outputCost + cacheCost;

    if (total === 0) return '$0.00 USD';
    const formatted = total < 0.005 ? '< $0.01' : `$${total.toFixed(4)}`;
    return `~${formatted} USD (models.dev pricing)`;
  }

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

  const inputPerMillion = isLightweight ? 0.15 : 3.0;
  const outputPerMillion = isLightweight ? 0.6 : 15.0;
  const cachePerMillion = isLightweight ? 0.075 : 0.3;

  const baseCost = (input * inputPerMillion) / 1_000_000;
  const outputCost = (output * outputPerMillion) / 1_000_000;
  const cacheCost = (cacheRead * cachePerMillion) / 1_000_000;
  const total = baseCost + outputCost + cacheCost;

  if (total === 0) return '$0.00 USD';
  const formatted = total < 0.005 ? '< $0.01' : `$${total.toFixed(2)}`;
  return `~${formatted} USD [estimated benchmark]`;
}

/**
 * /usage slash command: displays session token usage metrics, turn statistics,
 * and active model metadata specs (context window, max output tokens, modalities, pricing).
 */
export const usageCommand: SlashCommand = {
  name: 'usage',
  description: 'Displays token usage metrics, model metadata, and statistics for the current session',
  usage: '/usage',

  async execute(_args: string[], context: CommandContext): Promise<CommandResult> {
    const sessionData = context.session.session;
    const model = context.session.getModel();
    const usage = context.session.getUsage();
    const turns = sessionData?.turns ?? [];
    const turnsCount = turns.length;

    // Fetch active model metadata from @steward/models
    let metadata: ModelMetadata | undefined;
    try {
      metadata = await modelsClient.get(model.provider, model.modelId);
      if (!metadata) {
        const all = await modelsClient.list();
        metadata = all.find(
          (m) =>
            m.id.toLowerCase() === model.modelId.toLowerCase() &&
            (!model.provider || m.provider.toLowerCase() === model.provider.toLowerCase()),
        );
      }
    } catch {
      // Non-fatal, use basic metrics
    }

    // Count total tool executions accurately across all turns without double-counting
    let toolCallsCount = 0;
    for (const turn of turns) {
      if (Array.isArray(turn.messages)) {
        let turnToolCalls = 0;
        let turnToolMessages = 0;
        for (const msg of turn.messages) {
          if (msg.role === 'assistant' && Array.isArray(msg.content)) {
            turnToolCalls += msg.content.filter((c: any) => c?.type === 'tool-call').length;
          } else if (msg.role === 'tool') {
            turnToolMessages++;
          }
        }
        toolCallsCount += turnToolCalls > 0 ? turnToolCalls : turnToolMessages;
      }
    }

    const duration = formatDuration(sessionData?.createdAt);
    const costEstimate = estimateCost(usage, metadata, model.modelId, model.provider);

    const inputTokens = (usage as any).inputTokens ?? usage.input ?? 0;
    const outputTokens = (usage as any).outputTokens ?? usage.output ?? 0;
    const reasoningTokens = (usage as any).reasoningTokens ?? usage.reasoning ?? 0;
    const cacheReadTokens = (usage as any).cacheReadTokens ?? usage.cacheRead ?? 0;
    const cacheWriteTokens = (usage as any).cacheWriteTokens ?? usage.cacheWrite ?? 0;
    const totalTokens = (usage as any).totalTokens ?? usage.total ?? inputTokens + outputTokens;

    const lines: string[] = [
      `Session Usage & Analytics:`,
      `• Active Model: ${model.modelId} (${model.provider}${model.effort !== 'medium' ? `, effort: ${model.effort}` : ''})`,
      `• Session Duration: ${duration}`,
      `• Activity: ${formatNumber(turnsCount)} turns (${formatNumber(toolCallsCount)} tool executions)`,
      ``,
    ];

    if (metadata) {
      lines.push(`Model Specifications & Limits:`);
      if (metadata.name && metadata.name !== metadata.id) {
        lines.push(`• Display Name: ${metadata.name}`);
      }
      if (metadata.contextWindow) {
        lines.push(`• Context Window: ${formatNumber(metadata.contextWindow)} tokens`);
      }
      if (metadata.maxOutputTokens) {
        lines.push(`• Max Output: ${formatNumber(metadata.maxOutputTokens)} tokens`);
      }
      if (metadata.inputModalities && metadata.inputModalities.length > 0) {
        lines.push(`• Input Modalities: ${metadata.inputModalities.join(', ')}`);
      }
      if (metadata.outputModalities && metadata.outputModalities.length > 0) {
        lines.push(`• Output Modalities: ${metadata.outputModalities.join(', ')}`);
      }
      if (metadata.pricing) {
        const inP = metadata.pricing.input !== undefined ? `$${metadata.pricing.input}/1M` : undefined;
        const outP = metadata.pricing.output !== undefined ? `$${metadata.pricing.output}/1M` : undefined;
        if (inP && outP) {
          lines.push(`• Pricing: ${inP} in / ${outP} out`);
        }
      }
      lines.push(``);
    }

    lines.push(`Token Breakdown:`);
    lines.push(`• Input Tokens: ${formatNumber(inputTokens)}`);
    lines.push(`• Output Tokens: ${formatNumber(outputTokens)}`);

    if (reasoningTokens > 0) {
      lines.push(`• Reasoning Tokens: ${formatNumber(reasoningTokens)}`);
    }

    if (cacheReadTokens > 0) {
      const totalIn = inputTokens + cacheReadTokens;
      const hitRate = totalIn > 0 ? Math.round((cacheReadTokens / totalIn) * 100) : 0;
      lines.push(`• Cache Read Tokens: ${formatNumber(cacheReadTokens)} (${hitRate}% hit rate)`);
    }

    if (cacheWriteTokens > 0) {
      lines.push(`• Cache Write Tokens: ${formatNumber(cacheWriteTokens)}`);
    }

    lines.push(`• Total Tokens: ${formatNumber(totalTokens)}`);
    lines.push(``);
    lines.push(`Estimated Cost:`);
    lines.push(`• Session Spend: ${costEstimate}`);

    return {
      handled: true,
      message: lines.join('\n'),
    };
  },
};
