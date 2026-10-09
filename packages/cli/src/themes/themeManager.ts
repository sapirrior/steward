import type { Theme } from './themeTypes.js';
import defaultTheme from './default.json';
import githubTheme from './github.json';

const BUILTIN_THEMES: Record<string, Theme> = {
  default: defaultTheme as Theme,
  github: githubTheme as Theme,
};

export class ThemeManager {
  private currentTheme: Theme = defaultTheme as Theme;

  get theme(): Theme {
    return this.currentTheme;
  }

  setTheme(name?: string | null): Theme {
    const key = (name || '').trim().toLowerCase();
    const found = BUILTIN_THEMES[key];
    if (found) {
      this.currentTheme = found;
    } else {
      this.currentTheme = defaultTheme as Theme;
    }
    return this.currentTheme;
  }

  getTheme(name?: string | null): Theme {
    const key = (name || '').trim().toLowerCase();
    return BUILTIN_THEMES[key] ?? (defaultTheme as Theme);
  }

  listThemeNames(): string[] {
    return Object.keys(BUILTIN_THEMES);
  }

  listThemes(): Theme[] {
    return Object.values(BUILTIN_THEMES);
  }
}

export const themeManager = new ThemeManager();
