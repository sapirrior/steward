import { figures } from '@steward/tui/theme/index.js';
import { c, bg, bold } from '@steward/tui/theme/style.js';
import {
  formatMarkdown,
  getStatusBullet,
  truncateMiddle,
  extractPrimaryToolParam,
  visibleWidth,
} from './format.js';
import { wrapVisualLine } from '@steward/tui/engine/cell-layout.js';
import type { ToolExecutionStatus } from '../types.js';
import type { StructuredError } from '@steward/services/errors/index.js';
import type { ToolSummary } from '@steward/agents/tools/types.js';
import { renderToolDetail } from './tool-detail.js';
import {
  chooseTurnStatusVerb,
  STATUS_VERBS,
} from '@steward/services/session/logs/store.js';

import { formatUserMessage } from '@steward/tui/engine/user-message.js';

export { chooseTurnStatusVerb, STATUS_VERBS, formatUserMessage };

export function formatSystemMessage(content: string): string[] {
  const rawLines = content.split('\n');
  return rawLines.map((l, i) =>
    i === 0 ? `  ${c.muted('└ ')}${c.permission(l)}` : `    ${c.permission(l)}`,
  );
}

export function formatAssistantMessage(content: string): string[] {
  const lines: string[] = [];

  if (content) {
    const formatted = formatMarkdown(content);
    if (formatted) {
      const rawLines = formatted.split('\n');
      while (rawLines.length > 0 && !rawLines[0]?.trim()) {
        rawLines.shift();
      }
      while (rawLines.length > 0 && !rawLines[rawLines.length - 1]?.trim()) {
        rawLines.pop();
      }

      if (rawLines.length > 0) {
        lines.push('');
      }

      for (let i = 0; i < rawLines.length; i++) {
        const l = rawLines[i] ?? '';
        if (!l.trim()) {
          lines.push('');
          continue;
        }
        if (i === 0) {
          const bullet = c.text(`${figures.blackCircle} `);
          lines.push(`${bullet}${l}`);
        } else {
          lines.push(`  ${l}`);
        }
      }
    }
  }

  return lines;
}

export function formatToolStatus(options: {
  toolName: string;
  displayName?: string;
  icon?: string;
  argsSummary?: string;
  status: ToolExecutionStatus;
  durationMs?: number;
  error?: string;
  toolOutput?: string | ToolSummary;
  summary?: ToolSummary | string;
  targetWidth?: number;
}): string[] {
  const { toolName, displayName, icon, argsSummary, status, error, targetWidth } = options;
  const fullTermWidth =
    typeof targetWidth === 'number' && targetWidth > 0 ? targetWidth : process.stdout.columns || 80;

  const bullet = getStatusBullet(status);
  const dispName = displayName ?? icon ?? toolName;

  // Extract primary single-line argument
  const cleanFirstLine = extractPrimaryToolParam(argsSummary);
  const maxArgLen = Math.max(10, fullTermWidth - dispName.length - 8);
  const truncatedArg =
    cleanFirstLine.length > maxArgLen ? truncateMiddle(cleanFirstLine, maxArgLen) : cleanFirstLine;

  let mainLine = `${bullet} ${bold(dispName)}`;
  if (truncatedArg) {
    mainLine += `${c.muted('(')}${c.muted(truncatedArg)}${c.muted(')')}`;
  } else {
    mainLine += `${c.muted('()')}`;
  }

  const lines: string[] = [mainLine];

  const summaryVal = options.summary ?? options.toolOutput;

  // Completed successful calls display the tool summary and optional detail block
  if (status === 'completed' && summaryVal) {
    let headline = '';
    let detailText = '';

    if (typeof summaryVal === 'string') {
      const outputLines = summaryVal.trim().split('\n');
      headline = outputLines[0]?.trim() ?? '';
      detailText = outputLines.slice(1).join('\n');
    } else {
      headline = summaryVal.headline;
      if (summaryVal.detail) {
        detailText = renderToolDetail(summaryVal.detail);
      }
    }

    if (headline) {
      const maxOutLen = Math.max(10, fullTermWidth - 6);
      const truncatedSummary =
        headline.length > maxOutLen ? `${headline.slice(0, maxOutLen - 1)}…` : headline;
      lines.push(`  ${c.muted('└ ')}${c.text(truncatedSummary)}`);

      if (detailText) {
        const detailLines = detailText.split('\n');
        const maxContentWidth = Math.max(
          30,
          Math.min(fullTermWidth - 4, Math.floor(fullTermWidth * 0.85)),
        );

        for (const rawLine of detailLines) {
          const prefixed = `   ${rawLine}`;
          const wrapped = wrapVisualLine(prefixed, maxContentWidth, '     ');
          lines.push(...wrapped);
        }
      }
    }
  }

  // Failed calls display a single-line red error continuation
  if (status === 'failed' || error) {
    const rawError = error || 'Operation failed';
    const firstLineErr = rawError.split('\n')[0]?.trim() || rawError;
    const maxErrLen = Math.max(10, fullTermWidth - 6);
    const truncatedErr =
      firstLineErr.length > maxErrLen ? `${firstLineErr.slice(0, maxErrLen - 1)}…` : firstLineErr;
    lines.push(`  ${c.muted('└ ')}${c.error(truncatedErr)}`);
  }

  return lines;
}

export function formatErrorBadge(
  error: StructuredError,
  retryInfo?: { attempt: number; maxAttempts: number; countdownSec: number },
): string[] {
  const ast = c.error(figures.asterisk);
  const midDot = c.muted(` ${figures.bullet} `);

  let msg = error.shortMessage;
  if (retryInfo) {
    const retryStr = c.muted(
      `Retrying in ${retryInfo.countdownSec}s · attempt ${retryInfo.attempt}/${retryInfo.maxAttempts}`,
    );
    msg = `${c.error(error.shortMessage)}${midDot}${retryStr}`;
  } else {
    msg = c.error(error.shortMessage);
  }

  const lines: string[] = [`${ast} ${msg}`];

  if (error.suggestedAction) {
    lines.push(`  ${c.muted('└ ')}${c.muted(error.suggestedAction)}`);
  }

  return lines;
}

export function formatTurnStatus(
  durationMs: number,
  timestamp = new Date(),
  verb?: string,
): string {
  const selectedVerb = verb ?? chooseTurnStatusVerb();
  const sec = Math.max(1, Math.round(durationMs / 1000));
  const timeStr = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const midDot = c.muted(` ${figures.bullet} `);

  return `${c.muted(`${figures.asterisk} ${selectedVerb} for ${sec}s`)}${midDot}${c.muted(`done ${timeStr}`)}`;
}
