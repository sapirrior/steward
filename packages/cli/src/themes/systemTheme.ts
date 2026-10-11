/**
 * @file systemTheme.ts
 * @description Terminal dark/light mode detection for 'auto' theme resolution.
 */

import type { SystemTheme, ThemeName, ThemeSetting } from './themeTypes.js';

let cachedSystemTheme: SystemTheme | undefined;

/**
 * Resets the cached terminal theme (useful for test isolation).
 */
export function resetSystemThemeCache(): void {
  cachedSystemTheme = undefined;
}

/**
 * Updates the cached terminal theme.
 */
export function setCachedSystemTheme(theme: SystemTheme): void {
  cachedSystemTheme = theme;
}

/**
 * Gets the current terminal theme ('dark' or 'light').
 * Cached after first check; seeded from $COLORFGBG or defaults to 'dark'.
 */
export function getSystemThemeName(): SystemTheme {
  if (cachedSystemTheme === undefined) {
    cachedSystemTheme = detectFromColorFgBg() ?? 'dark';
  }
  return cachedSystemTheme;
}

/**
 * Resolves a ThemeSetting (which may be 'auto' or undefined) to a concrete ThemeName.
 */
export function resolveThemeSetting(setting?: string | null): ThemeName {
  const norm = (setting || '').trim().toLowerCase();
  if (!norm || norm === 'auto') {
    return getSystemThemeName();
  }

  const validThemeNames: readonly string[] = [
    'dark',
    'light',
    'dark-daltonized',
    'light-daltonized',
    'dark-ansi',
    'light-ansi',
  ];

  if (validThemeNames.includes(norm)) {
    return norm as ThemeName;
  }

  return 'dark';
}

/**
 * Parse an OSC 10/11 color response data string into a system theme.
 * Accepts XParseColor formats returned by OSC 11 queries:
 * - rgb:R/G/B where each component is 1-4 hex digits
 * - #RRGGBB / #RRRRGGGGBBBB
 */
export function themeFromOscColor(data: string): SystemTheme | undefined {
  const rgb = parseOscRgb(data);
  if (!rgb) return undefined;
  // ITU-R BT.709 relative luminance formula: > 0.5 is light
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance > 0.5 ? 'light' : 'dark';
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function parseOscRgb(data: string): Rgb | undefined {
  const rgbMatch = /^rgba?:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(data);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: hexComponent(rgbMatch[1]),
      g: hexComponent(rgbMatch[2]),
      b: hexComponent(rgbMatch[3]),
    };
  }

  const hashMatch = /^#([0-9a-f]+)$/i.exec(data);
  if (hashMatch && hashMatch[1] && hashMatch[1].length % 3 === 0) {
    const hex = hashMatch[1];
    const n = hex.length / 3;
    return {
      r: hexComponent(hex.slice(0, n)),
      g: hexComponent(hex.slice(n, 2 * n)),
      b: hexComponent(hex.slice(2 * n)),
    };
  }

  return undefined;
}

function hexComponent(hex: string): number {
  const max = 16 ** hex.length - 1;
  return parseInt(hex, 16) / max;
}

/**
 * Read $COLORFGBG for synchronous initial terminal background guess.
 * Format is `fg;bg` or `fg;other;bg` where values are ANSI indices.
 */
function detectFromColorFgBg(): SystemTheme | undefined {
  const colorfgbg = process.env['COLORFGBG'];
  if (!colorfgbg) return undefined;
  const parts = colorfgbg.split(';');
  const bg = parts[parts.length - 1];
  if (bg === undefined || bg === '') return undefined;
  const bgNum = Number(bg);
  if (!Number.isInteger(bgNum) || bgNum < 0 || bgNum > 15) return undefined;
  // 0-6 and 8 are dark ANSI backgrounds; 7 and 9-15 are light
  return bgNum <= 6 || bgNum === 8 ? 'dark' : 'light';
}
