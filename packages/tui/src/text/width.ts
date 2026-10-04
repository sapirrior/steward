import stringWidth from 'string-width';
import { ANSI_ESCAPE_REGEX, stripAnsi } from './ansi.js';

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemeWidthCache = new Map<string, number>();

/**
 * Expands tab characters (\t) to spaces advancing to the next tab stop.
 */
export function expandTabs(text: string, tabWidth = 4): string {
  if (!text || !text.includes('\t')) return text;
  let result = '';
  let col = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '\t') {
      const spaces = tabWidth - (col % tabWidth);
      result += ' '.repeat(spaces);
      col += spaces;
    } else if (ch === '\n' || ch === '\r') {
      result += ch;
      col = 0;
    } else {
      result += ch;
      col += 1;
    }
  }
  return result;
}

/**
 * Splits text into user-perceived grapheme clusters.
 */
export function segmentGraphemes(text: string): string[] {
  if (!text) return [];
  const segments: string[] = [];
  for (const segment of graphemeSegmenter.segment(text)) {
    segments.push(segment.segment);
  }
  return segments;
}

/**
 * Computes display cell width of a single grapheme cluster.
 */
export function graphemeWidth(grapheme: string): number {
  if (!grapheme) return 0;
  // ASCII fast-path
  if (grapheme.length === 1) {
    const code = grapheme.charCodeAt(0);
    if (code >= 32 && code <= 126) return 1;
    if (code < 32 || code === 127) return 0;
  }

  const cached = graphemeWidthCache.get(grapheme);
  if (cached !== undefined) return cached;

  const w = stringWidth(grapheme);
  if (graphemeWidthCache.size < 4096) {
    graphemeWidthCache.set(grapheme, w);
  }
  return w;
}

/**
 * Computes total visible width of a string (ignoring ANSI escapes).
 */
export function visibleWidth(text: string): number {
  if (!text) return 0;
  const clean = stripAnsi(text);
  let total = 0;
  for (const g of segmentGraphemes(clean)) {
    total += graphemeWidth(g);
  }
  return total;
}

/**
 * Computes 1-indexed column for a given logical visible character offset (skipping ANSI escapes).
 */
export function visibleColumnAtOffset(text: string, charOffset: number): number {
  if (charOffset <= 0 || !text) return 1;
  const ansiRegex = new RegExp(ANSI_ESCAPE_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let col = 1;
  let countedChars = 0;

  const processPlain = (plain: string) => {
    for (const g of segmentGraphemes(plain)) {
      if (countedChars >= charOffset) return;
      col += graphemeWidth(g);
      countedChars += g.length;
    }
  };

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      processPlain(text.slice(lastIndex, match.index));
      if (countedChars >= charOffset) return col;
    }
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length && countedChars < charOffset) {
    processPlain(text.slice(lastIndex));
  }

  return col;
}

