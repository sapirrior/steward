/**
 * @file figures.ts
 * @description Unicode symbols, terminal glyphs, spinners, and emblems for Steward.
 */

export const BLACK_CIRCLE = process.platform === 'darwin' ? '⏺' : '●';
export const BULLET_OPERATOR = '∙';
export const TEARDROP_ASTERISK = '✻';
export const UP_ARROW = '\u2191';
export const DOWN_ARROW = '\u2193';
export const LIGHTNING_BOLT = '↯';

// Effort indicators
export const EFFORT_LOW = '○';
export const EFFORT_MEDIUM = '◐';
export const EFFORT_HIGH = '●';
export const EFFORT_MAX = '◉';

// Trigger & status indicators
export const PLAY_ICON = '▶';
export const PAUSE_ICON = '⏸';
export const REFRESH_ARROW = '↻';
export const BLOCKQUOTE_BAR = '▎';
export const HEAVY_HORIZONTAL = '━';
export const CHECK_MARK = '✓';
export const CROSS_MARK = '✗';
export const PROMPT_CHEVRON = '❯';

export const TOOL_GLYPHS = {
  read: '✱',
  glob: '✱',
  grep: '✱',
  webfetch: '✻',
  websearch: '✻',
  bash: '$',
} as const;

export const UI_GLYPHS = {
  accentBar: BLOCKQUOTE_BAR,
  promptChevron: PROMPT_CHEVRON,
  check: CHECK_MARK,
  cross: CROSS_MARK,
  bullet: BLACK_CIRCLE,
  runningSpinner: '✢',
} as const;

/**
 * OS-specific flower growth spinner frames.
 */
export const SPINNER_FRAMES = {
  darwin: ['·', '✢', '✳', '✶', '✻', '✽'],
  linux: ['·', '✢', '*', '✶', '✻', '✽'],
  win32: ['·', '✢', '*', '✶', '✻', '✽'],
} as const;

export function getSpinnerFrames(platform: NodeJS.Platform = process.platform): readonly string[] {
  if (platform === 'darwin') return SPINNER_FRAMES.darwin;
  if (platform === 'win32') return SPINNER_FRAMES.win32;
  return SPINNER_FRAMES.linux;
}

/**
 * Unicode block-font Steward logo
 */
export const STEWARD_UNICODE_LOGO = [
  '                                  ▄ ',
  '█▀▀▀ ▀█▀▀ █▀▀█ █ █ █ ▀▀▀█ █▀▀▄ █▀▀█ ',
  '▀▀▀█  █   █▀▀▀ █░█░█ █▀▀█ █    █░░█ ',
  '▀▀▀▀  ▀   ▀▀▀▀ ▀▀ ▀▀ ▀▀▀▀ ▀    ▀▀▀▀ ',
].join('\n');

/**
 * Compact block-font 'S' emblem from the Steward logo
 */
export const STEWARD_S_GLYPH = [
  '█▀▀▀',
  '▀▀▀█',
  '▀▀▀▀',
] as const;
