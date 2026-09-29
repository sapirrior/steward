import chalk from 'chalk';
import { getTheme, type UITheme } from './colors.js';
import { resolveThemeColor } from './apply.js';

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

let _themeVersion = 0;

export function themeVersion(): number {
  return _themeVersion;
}

export function bumpThemeVersion(): void {
  _themeVersion++;
}

const colorCache = new Map<string, (s: string) => string>();
let cachedVersion = -1;

function getCachedColor(token: string, isBg: boolean): (s: string) => string {
  if (chalk.level === 0) {
    return (s: string) => s;
  }
  const v = _themeVersion;
  if (v !== cachedVersion) {
    colorCache.clear();
    cachedVersion = v;
  }
  const key = `${isBg ? 'bg:' : 'fg:'}${token}`;
  let fn = colorCache.get(key);
  if (!fn) {
    const theme = getTheme();
    const colorStr = (theme as any)[token];
    fn = resolveThemeColor(colorStr ?? (isBg ? 'default' : 'default'), isBg);
    colorCache.set(key, fn);
  }
  return fn;
}

export const c: Record<ColorToken, (s: string) => string> = new Proxy(
  {} as Record<ColorToken, (s: string) => string>,
  {
    get(_target, prop: string) {
      return (s: string) => getCachedColor(prop, false)(s);
    },
  },
);

export const bg: Record<BgToken, (s: string) => string> = new Proxy(
  {} as Record<BgToken, (s: string) => string>,
  {
    get(_target, prop: string) {
      return (s: string) => getCachedColor(prop, true)(s);
    },
  },
);

export const bold = (s: string): string => (chalk.level === 0 ? s : chalk.bold(s));
export const italic = (s: string): string => (chalk.level === 0 ? s : chalk.italic(s));
export const underline = (s: string): string => (chalk.level === 0 ? s : chalk.underline(s));
export const strikethrough = (s: string): string =>
  chalk.level === 0 ? s : chalk.strikethrough(s);
