/**
 * @file themeManager.ts
 * @description ThemeManager coordinator: in-memory state, settings persistence via settingsStore,
 * and token color retrieval.
 */

import { settingsStore } from '../settings/settingsStore.js';
import { getTheme } from './palettes.js';
import { resolveThemeSetting } from './systemTheme.js';
import {
  THEME_NAMES,
  THEME_SETTINGS,
  type Theme,
  type ThemeName,
  type ThemeSetting,
} from './themeTypes.js';

export { getTheme } from './palettes.js';
export { resolveThemeSetting } from './systemTheme.js';

export class ThemeManager {
  private currentSetting: ThemeSetting;
  private currentThemeName: ThemeName;
  private currentTheme: Theme;

  constructor(defaultSetting: ThemeSetting = 'dark') {
    this.currentSetting = defaultSetting;
    this.currentThemeName = resolveThemeSetting(defaultSetting);
    this.currentTheme = getTheme(this.currentThemeName);
  }

  /**
   * The current active resolved theme definition.
   */
  get theme(): Theme {
    return this.currentTheme;
  }

  /**
   * The resolved ThemeName currently rendered (never 'auto').
   */
  get themeName(): ThemeName {
    return this.currentThemeName;
  }

  /**
   * The active user theme setting (may be 'auto').
   */
  get themeSetting(): ThemeSetting {
    return this.currentSetting;
  }

  /**
   * Retrieves a specific color token for the currently active theme.
   * e.g. themeManager.getColor('promptBorder') => 'rgb(136,136,136)'
   */
  getColor(token: keyof Theme): string {
    return this.currentTheme[token] ?? '';
  }

  /**
   * Retrieves a Theme definition for any given theme setting or name.
   * If omitted, returns the active theme.
   */
  getTheme(settingOrName?: string | null): Theme {
    if (!settingOrName) {
      return this.currentTheme;
    }
    const resolvedName = resolveThemeSetting(settingOrName);
    return getTheme(resolvedName);
  }

  /**
   * Sets the active theme in memory (without writing to disk).
   * Resolves 'auto' to the terminal system appearance.
   */
  setTheme(setting?: string | null): ThemeName {
    const validSetting = (setting || '').trim().toLowerCase() as ThemeSetting;
    this.currentSetting = (
      THE_SETTINGS_SET.has(validSetting) ? validSetting : 'dark'
    ) as ThemeSetting;
    this.currentThemeName = resolveThemeSetting(this.currentSetting);
    this.currentTheme = getTheme(this.currentThemeName);
    return this.currentThemeName;
  }

  /**
   * Sets the theme in memory AND saves it to disk via settingsStore.
   */
  async saveTheme(setting: ThemeSetting): Promise<ThemeName> {
    const resolved = this.setTheme(setting);
    await settingsStore.update({ theme: this.currentSetting });
    return resolved;
  }

  /**
   * Synchronizes and loads the theme from settingsStore.
   */
  async loadFromSettings(): Promise<ThemeName> {
    try {
      const settings = await settingsStore.load();
      return this.setTheme(settings.theme as ThemeSetting);
    } catch {
      return this.setTheme('dark');
    }
  }

  /**
   * Lists all concrete renderable theme names.
   */
  listThemeNames(): readonly ThemeName[] {
    return THEME_NAMES;
  }

  /**
   * Lists all available theme settings including 'auto'.
   */
  listThemeSettings(): readonly ThemeSetting[] {
    return THEME_SETTINGS;
  }
}

const THE_SETTINGS_SET = new Set<string>(THEME_SETTINGS);

export const themeManager = new ThemeManager('dark');

/**
 * Convenience helper to get a specific color token for the active theme.
 */
export function getThemeColor(token: keyof Theme): string {
  return themeManager.getColor(token);
}

/**
 * Convenience helper to set theme in memory.
 */
export function setTheme(setting: ThemeSetting): ThemeName {
  return themeManager.setTheme(setting);
}

/**
 * Convenience helper to set theme and save to settingsStore.
 */
export async function saveTheme(setting: ThemeSetting): Promise<ThemeName> {
  return themeManager.saveTheme(setting);
}

/**
 * Converts a theme color (e.g. 'rgb(215,119,87)' or 'ansi:redBright') to ANSI escape code.
 */
export function themeColorToAnsi(themeColor: string): string {
  const rgbMatch = themeColor.match(/rgb\(\s?(\d+),\s?(\d+),\s?(\d+)\s?\)/);
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return `\x1b[38;2;${r};${g};${b}m`;
  }

  // Handle standard ANSI mappings
  const ansiMatch = themeColor.match(/^ansi:([a-zA-Z]+)$/);
  if (ansiMatch && ansiMatch[1]) {
    const code = ANSI_FG_MAP[ansiMatch[1]];
    if (code) return `\x1b[${code}m`;
  }

  return '\x1b[39m';
}

const ANSI_FG_MAP: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  blackBright: 90,
  redBright: 91,
  greenBright: 92,
  yellowBright: 93,
  blueBright: 94,
  magentaBright: 95,
  cyanBright: 96,
  whiteBright: 97,
};
