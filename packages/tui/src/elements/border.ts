import type { BorderGlyphs, BorderStyle } from './types.js';

export const BORDER_STYLES: Record<string, BorderGlyphs> = {
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  },
  round: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
  bold: {
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
    horizontal: '━',
    vertical: '┃',
  },
  singleDouble: {
    topLeft: '╓',
    topRight: '╖',
    bottomLeft: '╙',
    bottomRight: '╜',
    horizontal: '─',
    vertical: '║',
  },
  doubleSingle: {
    topLeft: '╒',
    topRight: '╕',
    bottomLeft: '╘',
    bottomRight: '╛',
    horizontal: '═',
    vertical: '│',
  },
  classic: {
    topLeft: '+',
    topRight: '+',
    bottomLeft: '+',
    bottomRight: '+',
    horizontal: '-',
    vertical: '|',
  },
};

export function resolveBorderStyle(style?: BorderStyle): BorderGlyphs | null {
  if (!style) return null;
  if (typeof style === 'string') {
    return BORDER_STYLES[style] ?? BORDER_STYLES.single;
  }
  return style;
}
