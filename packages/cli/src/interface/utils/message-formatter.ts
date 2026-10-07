import { figures } from '../../theme/figures.js';
import { c, bg, bold } from '../../theme/style.js';
import {
  formatMarkdown,
  getStatusBullet,
  truncateMiddle,
  extractPrimaryToolParam,
} from './format.js';
import { wrapVisualLine, visibleWidth } from 'stitchable';
import type { ToolExecutionStatus } from '../../services/session/types.js';
import { type ToolSummary } from '../../tools/types.js';
import { chooseTurnStatusVerb, STATUS_VERBS } from '../../services/session/index.js';
import { presentError, type PresentedError } from '../../errors/present.js';
import { renderToolDetail } from './tool-detail.js';

export function formatUserMessage(content: string, targetWidth?: number): string[] {
  const termCols =
    typeof targetWidth === 'number' && targetWidth > 0 ? targetWidth : process.stdout.columns || 80;
  const pointer = `${figures.pointerBold} `;
  const prefix = pointer;

  const availableTextWidth = Math.max(10, termCols - 2);
  const vLines = content.split('\n');
  const lines: string[] = [];

  let isFirstRow = true;
  for (let i = 0; i < vLines.length; i++) {
    const rawLine = vLines[i] ?? '';
    const wrappedSegments = rawLine ? wrapVisualLine(rawLine, availableTextWidth) : [''];

    for (const segment of wrappedSegments) {
      const p = isFirstRow ? prefix : '  ';
      isFirstRow = false;
      const visibleLen = visibleWidth(p) + visibleWidth(segment);
      const padLen = Math.max(0, termCols - visibleLen);
      const pStyled = c.userChevron(p);
      const textStyled = c.text(segment);
      const fullRow = bg.userBg(`${pStyled}${textStyled}${' '.repeat(padLen)}`);
      lines.push(fullRow);
    }
  }

  return lines;
}

export const formatUserPrompt = formatUserMessage;

export { chooseTurnStatusVerb, STATUS_VERBS };

export function formatSlashCommandOutput(content: string): string[] {
  const rawLines = content.split('\n');
  return rawLines.map((l, i) => (i === 0 ? `  ${c.muted('└ ')}${c.text(l)}` : `    ${c.text(l)}`));
}

export const formatSystemMessage = formatSlashCommandOutput;

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
  expanded?: boolean;
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
        detailText = renderToolDetail(summaryVal.detail, fullTermWidth, options.expanded);
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

  // Failed calls display error continuation (single-line in normal mode, full output in expanded mode)
  if (status === 'failed' || error) {
    const rawError = error || 'Operation failed';
    const errLines = rawError.split('\n');
    const firstLineErr = errLines[0]?.trim() || rawError;
    const maxErrLen = Math.max(10, fullTermWidth - 6);
    const truncatedErr =
      firstLineErr.length > maxErrLen ? `${firstLineErr.slice(0, maxErrLen - 1)}…` : firstLineErr;
    lines.push(`  ${c.muted('└ ')}${c.error(truncatedErr)}`);

    if (options.expanded && errLines.length > 1) {
      for (let i = 1; i < errLines.length; i++) {
        const line = errLines[i];
        if (line.trim()) {
          lines.push(`     ${c.error(line)}`);
        }
      }
    }
  }

  return lines;
}

export function formatErrorBadge(
  error: PresentedError | unknown,
  retryInfo?: { attempt: number; maxAttempts: number; countdownSec: number },
): string[] {
  const presented: PresentedError =
    typeof error === 'object' && error !== null && 'headline' in error
      ? (error as PresentedError)
      : presentError(error);

  const isInfo = presented.tone === 'info';
  const isWarning = presented.tone === 'warning';
  const icon = isInfo
    ? c.muted(figures.info)
    : isWarning
      ? c.warning(figures.warning)
      : c.error(figures.asterisk);
  const midDot = c.muted(` ${figures.bullet} `);

  let msg = isInfo
    ? c.muted(presented.headline)
    : isWarning
      ? c.warning(presented.headline)
      : c.error(presented.headline);

  if (retryInfo) {
    const retryStr = c.muted(
      `Retrying in ${retryInfo.countdownSec}s · attempt ${retryInfo.attempt}/${retryInfo.maxAttempts}`,
    );
    msg = `${msg}${midDot}${retryStr}`;
  }

  const lines: string[] = [`${icon} ${msg}`];

  if (presented.hint) {
    lines.push(`  ${c.muted('└ ')}${c.muted(presented.hint)}`);
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
