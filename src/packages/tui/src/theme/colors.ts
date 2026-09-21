import { bumpThemeVersion } from './style.js';

export interface SyntaxTheme {
  keyword: string;
  string: string;
  number: string;
  literal: string;
  comment: string;
  function: string;
  type: string;
  variable: string;
  tag: string;
  attr: string;
  meta: string;
  addition: string;
  deletion: string;
  default: string;
}

/**
 * Theme palette with semantic tokens only.
 */
export interface UITheme {
  // Foregrounds
  text: string;
  muted: string;
  subtle: string;
  brand: string;
  info: string;
  success: string;
  warning: string;
  error: string;
  permission: string;
  selected: string;
  current: string;
  promptBorder: string;
  rule: string;
  userChevron: string;

  // Backgrounds
  userBg: string;
  diffAddBg: string;
  diffDelBg: string;

  // Diff Foregrounds
  diffAddFg: string;
  diffDelFg: string;

  // Syntax
  syntax: SyntaxTheme;
}

export type ThemeId = string;
export type ThemeName = string;

export interface ThemeMeta {
  name: string;
  label: string;
  description: string;
  theme: UITheme;
  source?: 'built-in' | string;
}

export const darkTheme: UITheme = {
  text: 'rgb(255,255,255)',
  muted: 'rgb(110,110,110)',
  subtle: 'rgb(80,80,80)',
  brand: 'rgb(215,119,87)',
  info: 'rgb(123,165,218)',
  success: 'rgb(78,186,101)',
  warning: 'rgb(255,193,7)',
  error: 'rgb(255,107,128)',
  permission: 'rgb(177,185,249)',
  selected: 'rgb(177,185,249)',
  current: 'rgb(255,193,7)',
  promptBorder: 'rgb(136,136,136)',
  rule: 'rgb(129,136,165)',
  userChevron: 'rgb(82,82,82)',

  userBg: 'rgb(55,55,55)',
  diffAddBg: 'rgb(19,54,14)',
  diffDelBg: 'rgb(54,5,9)',

  diffAddFg: 'rgb(126,231,135)',
  diffDelFg: 'rgb(255,123,114)',

  syntax: {
    keyword: '#ff7b72',
    string: '#a5d6ff',
    number: '#79c0ff',
    literal: '#79c0ff',
    comment: '#8b949e',
    function: '#d2a8ff',
    type: '#ffa657',
    variable: '#ffa657',
    tag: '#7ee787',
    attr: '#79c0ff',
    meta: '#79c0ff',
    addition: '#7ee787',
    deletion: '#ffa198',
    default: '#c9d1d9',
  },
};

export const lightTheme: UITheme = {
  text: 'default',
  muted: 'rgb(120,120,120)',
  subtle: 'rgb(175,175,175)',
  brand: 'rgb(215,119,87)',
  info: 'rgb(40,100,180)',
  success: 'rgb(44,122,57)',
  warning: 'rgb(150,108,30)',
  error: 'rgb(171,43,63)',
  permission: 'rgb(87,105,247)',
  selected: 'rgb(87,105,247)',
  current: 'rgb(150,108,30)',
  promptBorder: 'rgb(153,153,153)',
  rule: 'rgb(120,130,160)',
  userChevron: 'rgb(160,160,160)',

  userBg: 'rgb(240,240,240)',
  diffAddBg: 'rgb(220,245,220)',
  diffDelBg: 'rgb(255,230,230)',

  diffAddFg: 'rgb(30,120,40)',
  diffDelFg: 'rgb(180,40,40)',

  syntax: {
    keyword: '#d73a49',
    string: '#032f62',
    number: '#005cc5',
    literal: '#005cc5',
    comment: '#6a737d',
    function: '#6f42c1',
    type: '#e36209',
    variable: '#e36209',
    tag: '#22863a',
    attr: '#005cc5',
    meta: '#005cc5',
    addition: '#22863a',
    deletion: '#b31d28',
    default: 'default',
  },
};

export const draculaTheme: UITheme = {
  text: 'rgb(248,248,242)',
  muted: 'rgb(98,114,164)',
  subtle: 'rgb(68,71,90)',
  brand: 'rgb(255,184,108)',
  info: 'rgb(139,233,253)',
  success: 'rgb(80,250,123)',
  warning: 'rgb(255,184,108)',
  error: 'rgb(255,85,85)',
  permission: 'rgb(189,147,249)',
  selected: 'rgb(189,147,249)',
  current: 'rgb(255,184,108)',
  promptBorder: 'rgb(98,114,164)',
  rule: 'rgb(189,147,249)',
  userChevron: 'rgb(98,114,164)',

  userBg: 'rgb(68,71,90)',
  diffAddBg: 'rgb(12,38,18)',
  diffDelBg: 'rgb(45,15,15)',

  diffAddFg: 'rgb(80,250,123)',
  diffDelFg: 'rgb(255,85,85)',

  syntax: {
    keyword: 'rgb(255,121,198)',
    string: 'rgb(241,250,140)',
    number: 'rgb(189,147,249)',
    literal: 'rgb(189,147,249)',
    comment: 'rgb(98,114,164)',
    function: 'rgb(80,250,123)',
    type: 'rgb(139,233,253)',
    variable: 'rgb(255,184,108)',
    tag: 'rgb(255,121,198)',
    attr: 'rgb(80,250,123)',
    meta: 'rgb(255,121,198)',
    addition: 'rgb(80,250,123)',
    deletion: 'rgb(255,85,85)',
    default: 'rgb(248,248,242)',
  },
};

export const darkAnsiTheme: UITheme = {
  text: 'default',
  muted: 'dim',
  subtle: 'dim',
  brand: 'ansi(yellow)',
  info: 'ansi(cyan)',
  success: 'ansi(green)',
  warning: 'ansi(yellow)',
  error: 'ansi(red)',
  permission: 'ansi(blue)',
  selected: 'ansi(blue)',
  current: 'ansi(yellow)',
  promptBorder: 'dim',
  rule: 'dim',
  userChevron: 'dim',

  userBg: 'ansi(bgBlackBright)',
  diffAddBg: 'default',
  diffDelBg: 'default',

  diffAddFg: 'ansi(green)',
  diffDelFg: 'ansi(red)',

  syntax: {
    keyword: 'ansi(red)',
    string: 'ansi(cyan)',
    number: 'ansi(cyan)',
    literal: 'ansi(cyan)',
    comment: 'ansi(gray)',
    function: 'ansi(magenta)',
    type: 'ansi(yellow)',
    variable: 'ansi(yellow)',
    tag: 'ansi(green)',
    attr: 'ansi(cyan)',
    meta: 'ansi(blue)',
    addition: 'ansi(green)',
    deletion: 'ansi(red)',
    default: 'ansi(white)',
  },
};

export const lightAnsiTheme: UITheme = {
  text: 'default',
  muted: 'dim',
  subtle: 'dim',
  brand: 'ansi(yellow)',
  info: 'ansi(blue)',
  success: 'ansi(green)',
  warning: 'ansi(yellow)',
  error: 'ansi(red)',
  permission: 'ansi(blue)',
  selected: 'ansi(blue)',
  current: 'ansi(yellow)',
  promptBorder: 'dim',
  rule: 'dim',
  userChevron: 'dim',

  userBg: 'ansi(bgWhiteBright)',
  diffAddBg: 'default',
  diffDelBg: 'default',

  diffAddFg: 'ansi(green)',
  diffDelFg: 'ansi(red)',

  syntax: {
    keyword: 'ansi(red)',
    string: 'ansi(blue)',
    number: 'ansi(blue)',
    literal: 'ansi(blue)',
    comment: 'ansi(gray)',
    function: 'ansi(magenta)',
    type: 'ansi(yellow)',
    variable: 'ansi(yellow)',
    tag: 'ansi(green)',
    attr: 'ansi(blue)',
    meta: 'ansi(blue)',
    addition: 'ansi(green)',
    deletion: 'ansi(red)',
    default: 'default',
  },
};

const builtInThemes: ThemeMeta[] = [
  {
    name: 'dark',
    label: 'Dark (Default)',
    description: 'Default dark theme with terracotta and purple accents',
    theme: darkTheme,
    source: 'built-in',
  },
  {
    name: 'light',
    label: 'Light',
    description: 'Clean light palette optimized for light backgrounds',
    theme: lightTheme,
    source: 'built-in',
  },
  {
    name: 'dracula',
    label: 'Dracula',
    description: 'Official gothic-inspired vampire color scheme',
    theme: draculaTheme,
    source: 'built-in',
  },
  {
    name: 'dark-ansi',
    label: 'Dark ANSI',
    description: '16-color ANSI palette respecting your terminal theme',
    theme: darkAnsiTheme,
    source: 'built-in',
  },
  {
    name: 'light-ansi',
    label: 'Light ANSI',
    description: '16-color ANSI light palette respecting terminal colors',
    theme: lightAnsiTheme,
    source: 'built-in',
  },
];

const registry = new Map<string, ThemeMeta>();
for (const t of builtInThemes) {
  registry.set(t.name, t);
}

let activeThemeId = 'dark';

export function registerTheme(meta: ThemeMeta): void {
  registry.set(meta.name, meta);
}

export function listThemes(): ThemeMeta[] {
  return Array.from(registry.values());
}

export function findTheme(query: string): ThemeMeta | undefined {
  const q = query
    .trim()
    .toLowerCase()
    .replace(/^["']|["']$/g, '');
  if (!q) return undefined;
  return listThemes().find(
    (t) =>
      t.name.toLowerCase() === q ||
      t.label.toLowerCase() === q ||
      t.label.toLowerCase().startsWith(q),
  );
}

export function setActiveTheme(name: string): boolean {
  if (registry.has(name)) {
    activeThemeId = name;
    bumpThemeVersion();
    return true;
  }
  // Fallback to dark if unknown
  activeThemeId = 'dark';
  bumpThemeVersion();
  return false;
}

export function getActiveThemeId(): string {
  return activeThemeId;
}

export function getActiveThemeName(): string {
  return activeThemeId;
}

export function getTheme(): UITheme {
  return registry.get(activeThemeId)?.theme ?? darkTheme;
}
