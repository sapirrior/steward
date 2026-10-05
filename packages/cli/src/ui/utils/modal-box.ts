import { figures, c } from '../../theme/index.js';
import { visibleWidth, truncateToWidth } from './format.js';
import { renderElement } from 'stitchable';

export interface RenderModalBoxOptions {
  title: string;
  subtitle?: string;
  searchLine?: string;
  content: string[] | any[];
  footer?: string;
  width?: number;
}

/**
 * Clean line-based modal box helper matching Steward's visual design.
 */
export function renderModalBox(options: RenderModalBoxOptions): string[] {
  const termWidth = options.width ?? process.stdout.columns ?? 80;
  const maxCols = Math.max(1, termWidth);
  const divider = figures.horizontalLine.repeat(maxCols);

  const lines: string[] = [];
  lines.push(divider);

  // Header line: title + optional subtitle right-aligned
  if (options.subtitle) {
    const tWidth = visibleWidth(options.title);
    const sWidth = visibleWidth(options.subtitle);
    const gap = Math.max(1, maxCols - (tWidth + sWidth));
    const header = `${c.text(options.title)}${' '.repeat(gap)}${c.muted(options.subtitle)}`;
    lines.push(truncateToWidth(header, maxCols));
  } else {
    lines.push(truncateToWidth(c.text(options.title), maxCols));
  }

  // Optional search line
  if (options.searchLine) {
    lines.push(truncateToWidth(options.searchLine, maxCols));
    lines.push(divider);
  }

  // Content lines
  for (const item of options.content) {
    if (typeof item === 'string') {
      lines.push(truncateToWidth(item, maxCols));
    } else if (item && typeof item._getLines === 'function') {
      const subLines = item._getLines(maxCols);
      for (const sl of subLines) lines.push(truncateToWidth(sl, maxCols));
    } else if (Array.isArray(item)) {
      for (const sl of item) lines.push(truncateToWidth(String(sl), maxCols));
    } else if (item && typeof item === 'object') {
      const rendered = renderElement(item, { width: maxCols });
      for (const sl of rendered) lines.push(truncateToWidth(sl, maxCols));
    }
  }

  // Footer
  if (options.footer) {
    lines.push(truncateToWidth(c.muted(options.footer), maxCols));
  }

  return lines;
}
