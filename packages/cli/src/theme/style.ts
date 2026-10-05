import chalk from 'chalk';
import { darkTheme } from './colors.js';

export type ColorToken =
  | 'text'
  | 'muted'
  | 'subtle'
  | 'brand'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'permission'
  | 'selected'
  | 'current'
  | 'promptBorder'
  | 'rule'
  | 'userChevron'
  | 'diffAddFg'
  | 'diffDelFg';

export type BgToken = 'userBg' | 'diffAddBg' | 'diffDelBg';

/**
 * Resolves an rgb(r,g,b) or #hex string into a chalk colorizer function.
 * Respects chalk.level === 0 for plain text identity.
 */
export function resolveThemeColor(color: string, isBg = false): (s: string) => string {
  if (chalk.level === 0 || !color || color === 'default') {
    return (s: string) => s;
  }

  if (color.startsWith('rgb(')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = [Number(match[0]), Number(match[1]), Number(match[2])];
      return isBg ? chalk.bgRgb(r, g, b) : chalk.rgb(r, g, b);
    }
  }

  if (color.startsWith('#')) {
    return isBg ? chalk.bgHex(color) : chalk.hex(color);
  }

  return (s: string) => s;
}

const fgTokens: ColorToken[] = [
  'text',
  'muted',
  'subtle',
  'brand',
  'info',
  'success',
  'warning',
  'error',
  'permission',
  'selected',
  'current',
  'promptBorder',
  'rule',
  'userChevron',
  'diffAddFg',
  'diffDelFg',
];

const bgTokens: BgToken[] = ['userBg', 'diffAddBg', 'diffDelBg'];

// Direct static records built once from canonical darkTheme palette
export const c = {} as Record<ColorToken, (s: string) => string>;
for (const token of fgTokens) {
  const colorStr = darkTheme[token];
  c[token] = resolveThemeColor(colorStr, false);
}

export const bg = {} as Record<BgToken, (s: string) => string>;
for (const token of bgTokens) {
  const colorStr = darkTheme[token];
  bg[token] = resolveThemeColor(colorStr, true);
}

export const bold = (s: string): string => (chalk.level === 0 ? s : chalk.bold(s));
export const italic = (s: string): string => (chalk.level === 0 ? s : chalk.italic(s));
export const underline = (s: string): string => (chalk.level === 0 ? s : chalk.underline(s));
export const strikethrough = (s: string): string =>
  chalk.level === 0 ? s : chalk.strikethrough(s);
