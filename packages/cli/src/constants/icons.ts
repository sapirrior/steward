/**
 * Steward CLI Glyphs and Icons
 * Strict PascalCase/camelCase conventions.
 */

export const TOOL_GLYPHS = {
  read: '✱',
  glob: '✱',
  grep: '✱',
  webfetch: '✻',
  websearch: '✻',
  bash: '$',
} as const;

export const UI_GLYPHS = {
  accentBar: '▎',
  promptChevron: '❯',
  check: '✓',
  cross: '✗',
  bullet: '●',
  runningSpinner: '✢',
} as const;

/**
 * OS-specific spinner frames matching Claude Code's flower growth cycle.
 * Darwin uses special Unicode characters; Linux/Windows use standard fallback.
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
