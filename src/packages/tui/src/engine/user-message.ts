import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';
import { figures } from '../theme/index.js';
import { c, bg } from '../theme/style.js';
import { wrapVisualLine } from './cell-layout.js';

/**
 * Formats user message input into themed banner lines with chevrons and background styling.
 */
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
      const visibleLen = stringWidth(stripAnsi(p)) + stringWidth(stripAnsi(segment));
      const padLen = Math.max(0, termCols - visibleLen);
      const pStyled = c.userChevron(p);
      const textStyled = c.text(segment);
      const fullRow = bg.userBg(`${pStyled}${textStyled}${' '.repeat(padLen)}`);
      lines.push(fullRow);
    }
  }

  return lines;
}
