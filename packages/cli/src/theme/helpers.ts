import chalk from 'chalk';
import type { Theme as HighlightTheme } from 'cli-highlight';
import { darkTheme, type UITheme } from './colors.js';

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

export const bold = (s: string): string => (chalk.level === 0 ? s : chalk.bold(s));
export const italic = (s: string): string => (chalk.level === 0 ? s : chalk.italic(s));
export const underline = (s: string): string => (chalk.level === 0 ? s : chalk.underline(s));
export const strikethrough = (s: string): string =>
  chalk.level === 0 ? s : chalk.strikethrough(s);

export function buildHighlightTheme(theme: UITheme): HighlightTheme {
  const syn = theme.syntax;
  const kw = resolveThemeColor(syn.keyword);
  const str = resolveThemeColor(syn.string);
  const num = resolveThemeColor(syn.number);
  const lit = resolveThemeColor(syn.literal);
  const com = resolveThemeColor(syn.comment);
  const fn = resolveThemeColor(syn.function);
  const typ = resolveThemeColor(syn.type);
  const vr = resolveThemeColor(syn.variable);
  const tg = resolveThemeColor(syn.tag);
  const at = resolveThemeColor(syn.attr);
  const mt = resolveThemeColor(syn.meta);
  const add = resolveThemeColor(syn.addition);
  const del = resolveThemeColor(syn.deletion);
  const def = resolveThemeColor(syn.default);

  return {
    keyword: kw,
    built_in: typ,
    type: typ,
    literal: lit,
    number: num,
    regexp: tg,
    string: str,
    subst: def,
    symbol: tg,
    class: typ,
    function: fn,
    title: fn,
    params: def,
    comment: (s: string) => com(italic(s)),
    doctag: kw,
    meta: mt,
    'meta-keyword': kw,
    'meta-string': str,
    section: (s: string) => mt(bold(s)),
    tag: tg,
    name: tg,
    'builtin-name': typ,
    attr: at,
    attribute: at,
    variable: vr,
    bullet: vr,
    code: def,
    emphasis: (s: string) => italic(s),
    strong: (s: string) => bold(s),
    formula: tg,
    link: (s: string) => str(underline(s)),
    quote: com,
    'selector-tag': tg,
    'selector-id': (s: string) => mt(bold(s)),
    'selector-class': at,
    'selector-attr': at,
    'selector-pseudo': at,
    'template-tag': tg,
    'template-variable': vr,
    addition: add,
    deletion: del,
    default: def,
  };
}

let cachedHighlightTheme: HighlightTheme | null = null;

export function getHighlightTheme(): HighlightTheme {
  if (chalk.level === 0) {
    return { default: (s: string) => s };
  }
  if (!cachedHighlightTheme) {
    cachedHighlightTheme = buildHighlightTheme(darkTheme);
  }
  return cachedHighlightTheme;
}
