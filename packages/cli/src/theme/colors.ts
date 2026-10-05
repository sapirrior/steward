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
    deletion: '#ff7b72',
    default: '#c9d1d9',
  },
};
