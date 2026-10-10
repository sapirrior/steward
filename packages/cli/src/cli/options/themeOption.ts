import { VALID_THEMES, type CliTheme } from '../types.js';

/**
 * Validates and normalizes theme option against supported themes ('default' and 'github').
 */
export function resolveThemeOption(
  rawTheme?: string,
  defaultTheme: CliTheme = 'default',
): CliTheme {
  if (!rawTheme || !rawTheme.trim()) {
    return defaultTheme;
  }

  const normalized = rawTheme.trim().toLowerCase() as CliTheme;

  if (VALID_THEMES.includes(normalized)) {
    return normalized;
  }

  throw new Error(`Invalid theme: '${rawTheme}'. Supported themes are: ${VALID_THEMES.join(', ')}`);
}
