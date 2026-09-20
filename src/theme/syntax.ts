import chalk from 'chalk';
import type { Theme as HighlightTheme } from 'cli-highlight';
import { getTheme, type UITheme } from './colors.js';
import { resolveThemeColor } from './apply.js';
import { themeVersion, bold, italic, underline } from './style.js';

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
let cachedHighlightVersion = -1;

export function getHighlightTheme(): HighlightTheme {
  if (chalk.level === 0) {
    return { default: (s: string) => s };
  }
  const v = themeVersion();
  if (!cachedHighlightTheme || v !== cachedHighlightVersion) {
    cachedHighlightTheme = buildHighlightTheme(getTheme());
    cachedHighlightVersion = v;
  }
  return cachedHighlightTheme;
}
