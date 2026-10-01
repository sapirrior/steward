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

/**
 * Canonical default dark theme palette.
 */
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

export const defaultTheme = darkTheme;

export function getTheme(): UITheme {
  return darkTheme;
}

export function getActiveThemeId(): string {
  return 'dark';
}

export function getActiveThemeName(): string {
  return 'dark';
}

export function setActiveTheme(_name: string): boolean {
  return true;
}

export function listThemes(): ThemeMeta[] {
  return [
    {
      name: 'dark',
      label: 'Dark (Default)',
      description: 'Default dark theme with terracotta and purple accents',
      theme: darkTheme,
      source: 'built-in',
    },
  ];
}

export function findTheme(query: string): ThemeMeta | undefined {
  const q = query.trim().toLowerCase();
  if (q === 'dark' || q === 'default') {
    return listThemes()[0];
  }
  return undefined;
}
