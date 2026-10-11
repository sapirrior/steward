/**
 * @file themeTypes.ts
 * @description Semantic theme color tokens and contracts for Steward CLI.
 */

export const THEME_NAMES = [
  'dark',
  'light',
  'light-daltonized',
  'dark-daltonized',
  'light-ansi',
  'dark-ansi',
] as const;

/** Concrete renderable theme name. Always resolvable to a palette. */
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_SETTINGS = ['auto', ...THEME_NAMES] as const;

/**
 * A theme preference as stored in user config.
 * 'auto' follows terminal/system light/dark mode and resolves to a ThemeName at runtime.
 */
export type ThemeSetting = (typeof THEME_SETTINGS)[number];

export type SystemTheme = 'dark' | 'light';

export interface Theme {
  readonly autoAccept: string;
  readonly bashBorder: string;
  readonly steward: string;
  readonly stewardShimmer: string;
  readonly permission: string;
  readonly permissionShimmer: string;
  readonly planMode: string;
  readonly ide: string;
  readonly promptBorder: string;
  readonly promptBorderShimmer: string;
  readonly text: string;
  readonly inverseText: string;
  readonly inactive: string;
  readonly inactiveShimmer: string;
  readonly subtle: string;
  readonly suggestion: string;
  readonly remember: string;
  readonly background: string;

  // Semantic colors
  readonly success: string;
  readonly error: string;
  readonly warning: string;
  readonly warningShimmer: string;
  readonly merged: string;

  // Diff colors
  readonly diffAdded: string;
  readonly diffRemoved: string;
  readonly diffAddedDimmed: string;
  readonly diffRemovedDimmed: string;
  readonly diffAddedWord: string;
  readonly diffRemovedWord: string;

  // TUI surfaces & backgrounds
  readonly userMessageBackground: string;
  readonly userMessageBackgroundHover: string;
  readonly messageActionsBackground: string;
  readonly selectionBg: string;
  readonly bashMessageBackgroundColor: string;
  readonly memoryBackgroundColor: string;
  readonly rate_limit_fill: string;
  readonly rate_limit_empty: string;
  readonly fastMode: string;
  readonly fastModeShimmer: string;
}
