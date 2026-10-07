import { figures } from '../../theme/figures.js';
import { resolveThemeColor, c, bold } from '../../theme/style.js';
import { applyMarkdown } from '../format/markdown.js';
import { visibleWidth, truncateToWidth, stripAnsi } from 'stitchable';

export function themeColor(color: string) {
  return resolveThemeColor(color, false);
}

export function themeBgColor(color: string) {
  return resolveThemeColor(color, true);
}

export function formatMarkdown(md: string): string {
  return applyMarkdown(md);
}

export function truncateMiddle(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  const leftChars = Math.floor((maxLength - 1) / 2);
  const rightChars = Math.ceil((maxLength - 1) / 2);
  return `${text.slice(0, leftChars)}…${text.slice(text.length - rightChars)}`;
}

export function extractPrimaryToolParam(args: unknown): string {
  if (!args) return '';
  if (typeof args === 'string') {
    try {
      const parsed = JSON.parse(args);
      return extractPrimaryToolParam(parsed);
    } catch {
      return args.split('\n')[0] ?? '';
    }
  }
  if (typeof args !== 'object' || args === null) {
    return String(args).split('\n')[0] ?? '';
  }

  const obj = args as Record<string, unknown>;

  // Common descriptive param priority
  const prioritizedKeys = [
    'command',
    'path',
    'file_path',
    'filePath',
    'pattern',
    'query',
    'url',
    'message',
    'action',
    'prompt',
  ];

  for (const key of prioritizedKeys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) {
      const val = obj[key];
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return str.split('\n')[0] ?? '';
    }
  }

  // Fallback to first string or value
  const keys = Object.keys(obj);
  if (keys.length > 0) {
    const firstVal = obj[keys[0]!];
    if (Array.isArray(firstVal))
      return `${firstVal.length} item${firstVal.length === 1 ? '' : 's'}`;
    const str = typeof firstVal === 'object' ? JSON.stringify(firstVal) : String(firstVal);
    return str.split('\n')[0] ?? '';
  }

  return '';
}

export function getStatusBullet(
  status: 'completed' | 'failed' | 'running' | 'streaming',
  pulse = false,
): string {
  if (status === 'completed') {
    return c.success(figures.blackCircle);
  }
  if (status === 'failed') {
    return c.error(figures.blackCircle);
  }
  if (pulse) {
    return bold(c.text(figures.blackCircle));
  }
  return c.muted(figures.blackCircle);
}

export { visibleWidth, truncateToWidth, stripAnsi, figures };
