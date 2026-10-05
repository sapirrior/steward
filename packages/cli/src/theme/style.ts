import { darkTheme } from './colors.js';
import { resolveThemeColor } from './helpers.js';

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

export { resolveThemeColor, bold, italic, underline, strikethrough } from './helpers.js';
