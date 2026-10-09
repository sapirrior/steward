import { describe, it, expect, beforeEach } from 'bun:test';
import { ThemeManager, themeManager } from './themeManager.js';
import type { Theme, ThemeColors } from './themeTypes.js';

describe('Theme System Hardcore Test Suite', () => {
  let manager: ThemeManager;

  beforeEach(() => {
    manager = new ThemeManager();
  });

  const REQUIRED_COLOR_KEYS: (keyof ThemeColors)[] = [
    'cardBackground',
    'dialogBackground',
    'selectionBackground',
    'text',
    'textMuted',
    'textDim',
    'accent',
    'accentActive',
    'success',
    'error',
    'warning',
    'border',
    'borderActive',
  ];

  const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

  // ─── 1. Default & Built-in Themes ───────────────────────────────────────────

  it('loads default OpenCode theme with required visual tokens', () => {
    const theme = manager.getTheme('default');
    expect(theme.name).toBe('default');
    expect(theme.isDark).toBe(true);

    // OpenCode signature tokens
    expect(theme.colors.cardBackground).toBe('#303030');
    expect(theme.colors.dialogBackground).toBe('#242424');
    expect(theme.colors.accent).toBe('#3b82f6');
    expect(theme.colors.warning).toBe('#d97706');
    expect(theme.colors.success).toBe('#22c55e');
  });

  it('loads github theme with required GitHub dark tokens', () => {
    const theme = manager.getTheme('github');
    expect(theme.name).toBe('github');
    expect(theme.isDark).toBe(true);

    // GitHub signature tokens
    expect(theme.colors.cardBackground).toBe('#161b22');
    expect(theme.colors.dialogBackground).toBe('#0d1117');
    expect(theme.colors.accent).toBe('#58a6ff');
    expect(theme.colors.warning).toBe('#d29922');
    expect(theme.colors.success).toBe('#3fb950');
  });

  // ─── 2. Color Validity & Token Completeness ─────────────────────────────────

  it('validates that all built-in themes have complete and valid hex color tokens', () => {
    const allThemes = manager.listThemes();
    expect(allThemes.length).toBeGreaterThanOrEqual(2);

    for (const theme of allThemes) {
      expect(typeof theme.name).toBe('string');
      expect(typeof theme.isDark).toBe('boolean');

      for (const key of REQUIRED_COLOR_KEYS) {
        const val = theme.colors[key];
        expect(val).toBeDefined();
        expect(typeof val).toBe('string');
        expect(HEX_COLOR_REGEX.test(val)).toBe(true);
      }
    }
  });

  // ─── 3. Case Insensitivity & Fallback Safety ────────────────────────────────

  it('handles case-insensitive theme lookups', () => {
    expect(manager.getTheme('DEFAULT').name).toBe('default');
    expect(manager.getTheme('GiThUb').name).toBe('github');
    expect(manager.getTheme('  github  ').name).toBe('github');
  });

  it('falls back safely to default theme on unknown or invalid theme names', () => {
    const fallback1 = manager.getTheme('monokai');
    expect(fallback1.name).toBe('default');

    const fallback2 = manager.getTheme('');
    expect(fallback2.name).toBe('default');

    const fallback3 = manager.getTheme(null as any);
    expect(fallback3.name).toBe('default');
  });

  // ─── 4. Theme Switching & State Mutation ────────────────────────────────────

  it('switches themes and maintains state correctly', () => {
    expect(manager.theme.name).toBe('default');

    const switched = manager.setTheme('github');
    expect(switched.name).toBe('github');
    expect(manager.theme.name).toBe('github');
    expect(manager.theme.colors.cardBackground).toBe('#161b22');

    // Setting invalid theme resets to default
    const reset = manager.setTheme('nonexistent');
    expect(reset.name).toBe('default');
    expect(manager.theme.name).toBe('default');
  });

  // ─── 5. Listing & Discovery ─────────────────────────────────────────────────

  it('lists all available theme names and instances', () => {
    const names = manager.listThemeNames();
    expect(names).toContain('default');
    expect(names).toContain('github');

    const themes = manager.listThemes();
    const themeMap = new Map(themes.map((t) => [t.name, t]));
    expect(themeMap.has('default')).toBe(true);
    expect(themeMap.has('github')).toBe(true);
  });

  it('exports a global singleton themeManager instance', () => {
    expect(themeManager).toBeInstanceOf(ThemeManager);
    expect(themeManager.theme.name).toBe('default');
  });
});
