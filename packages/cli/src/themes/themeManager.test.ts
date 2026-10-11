import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  ThemeManager,
  themeManager,
  getTheme,
  getThemeColor,
  setTheme,
  saveTheme,
  themeColorToAnsi,
} from './themeManager.js';
import {
  resolveThemeSetting,
  themeFromOscColor,
  resetSystemThemeCache,
  setCachedSystemTheme,
} from './systemTheme.js';
import { THEME_NAMES, THEME_SETTINGS, type Theme, type ThemeName } from './themeTypes.js';
import { settingsStore } from '../settings/settingsStore.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('Theme Subsystem Test Suite', () => {
  let manager: ThemeManager;
  let tempSettingsPath: string;
  let originalColorFgBg: string | undefined;

  const REQUIRED_COLOR_TOKENS: (keyof Theme)[] = [
    'autoAccept',
    'bashBorder',
    'steward',
    'stewardShimmer',
    'permission',
    'permissionShimmer',
    'planMode',
    'ide',
    'promptBorder',
    'promptBorderShimmer',
    'text',
    'inverseText',
    'inactive',
    'inactiveShimmer',
    'subtle',
    'suggestion',
    'remember',
    'background',
    'success',
    'error',
    'warning',
    'warningShimmer',
    'merged',
    'diffAdded',
    'diffRemoved',
    'diffAddedDimmed',
    'diffRemovedDimmed',
    'diffAddedWord',
    'diffRemovedWord',
    'userMessageBackground',
    'userMessageBackgroundHover',
    'messageActionsBackground',
    'selectionBg',
    'bashMessageBackgroundColor',
    'memoryBackgroundColor',
    'rate_limit_fill',
    'rate_limit_empty',
    'fastMode',
    'fastModeShimmer',
  ];

  beforeEach(() => {
    manager = new ThemeManager('dark');
    resetSystemThemeCache();
    originalColorFgBg = process.env['COLORFGBG'];
    delete process.env['COLORFGBG'];

    tempSettingsPath = path.join(
      os.tmpdir(),
      `steward-theme-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
    );
    (settingsStore as any).filePath = tempSettingsPath;
  });

  afterEach(() => {
    resetSystemThemeCache();
    if (originalColorFgBg !== undefined) {
      process.env['COLORFGBG'] = originalColorFgBg;
    } else {
      delete process.env['COLORFGBG'];
    }

    try {
      if (fs.existsSync(tempSettingsPath)) {
        fs.unlinkSync(tempSettingsPath);
      }
    } catch {}
  });

  // ─── 1. Palettes & Semantic Tokens ──────────────────────────────────────────

  it('provides all 6 complete palettes with every semantic token defined', () => {
    expect(THEME_NAMES).toEqual([
      'dark',
      'light',
      'light-daltonized',
      'dark-daltonized',
      'light-ansi',
      'dark-ansi',
    ]);

    for (const name of THEME_NAMES) {
      const palette = getTheme(name);
      expect(palette).toBeDefined();

      for (const token of REQUIRED_COLOR_TOKENS) {
        const val = palette[token];
        expect(val).toBeDefined();
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  // ─── 2. System Theme & 'auto' Resolution ─────────────────────────────────────

  it('resolves concrete theme names directly without alteration', () => {
    expect(resolveThemeSetting('dark')).toBe('dark');
    expect(resolveThemeSetting('light')).toBe('light');
    expect(resolveThemeSetting('dark-daltonized')).toBe('dark-daltonized');
    expect(resolveThemeSetting('light-daltonized')).toBe('light-daltonized');
    expect(resolveThemeSetting('dark-ansi')).toBe('dark-ansi');
    expect(resolveThemeSetting('light-ansi')).toBe('light-ansi');
  });

  it("resolves 'auto' based on terminal $COLORFGBG hint", () => {
    process.env['COLORFGBG'] = '15;0'; // Dark background
    resetSystemThemeCache();
    expect(resolveThemeSetting('auto')).toBe('dark');

    process.env['COLORFGBG'] = '0;15'; // Light background
    resetSystemThemeCache();
    expect(resolveThemeSetting('auto')).toBe('light');

    process.env['COLORFGBG'] = '15;7'; // Light background
    resetSystemThemeCache();
    expect(resolveThemeSetting('auto')).toBe('light');
  });

  it('parses OSC 11 color luminance correctly', () => {
    // Pure black (luminance 0) -> dark
    expect(themeFromOscColor('rgb:0000/0000/0000')).toBe('dark');
    expect(themeFromOscColor('#000000')).toBe('dark');

    // Pure white (luminance 1) -> light
    expect(themeFromOscColor('rgb:ffff/ffff/ffff')).toBe('light');
    expect(themeFromOscColor('#ffffff')).toBe('light');

    // Dark grey (#1e1e1e) -> dark
    expect(themeFromOscColor('#1e1e1e')).toBe('dark');

    // Light beige (#f5f5dc) -> light
    expect(themeFromOscColor('#f5f5dc')).toBe('light');

    // Invalid format returns undefined
    expect(themeFromOscColor('invalid-data')).toBeUndefined();
  });

  it("falls back safely to 'dark' for unknown or invalid theme settings", () => {
    expect(resolveThemeSetting('nonexistent')).toBe('dark');
    expect(resolveThemeSetting('')).toBe('dark');
    expect(resolveThemeSetting(null)).toBe('dark');
  });

  // ─── 3. In-Memory Theme Manager & Token Colors ──────────────────────────────

  it('retrieves specific token colors for the currently active theme', () => {
    manager.setTheme('dark');
    expect(manager.getColor('promptBorder')).toBe('rgb(136,136,136)');
    expect(manager.getColor('text')).toBe('rgb(255,255,255)');
    expect(manager.getColor('inverseText')).toBe('rgb(0,0,0)');

    manager.setTheme('light');
    expect(manager.getColor('promptBorder')).toBe('rgb(153,153,153)');
    expect(manager.getColor('text')).toBe('rgb(0,0,0)');
    expect(manager.getColor('inverseText')).toBe('rgb(255,255,255)');
  });

  it('handles case-insensitive and whitespace-padded theme settings', () => {
    expect(manager.setTheme('  LIGHT  ')).toBe('light');
    expect(manager.themeName).toBe('light');
    expect(manager.themeSetting).toBe('light');

    expect(manager.setTheme('DARK-DALTONIZED')).toBe('dark-daltonized');
    expect(manager.themeName).toBe('dark-daltonized');
  });

  it('resolves auto dynamically in theme manager', () => {
    setCachedSystemTheme('light');
    manager.setTheme('auto');
    expect(manager.themeSetting).toBe('auto');
    expect(manager.themeName).toBe('light');
    expect(manager.getColor('text')).toBe('rgb(0,0,0)');

    setCachedSystemTheme('dark');
    manager.setTheme('auto');
    expect(manager.themeName).toBe('dark');
    expect(manager.getColor('text')).toBe('rgb(255,255,255)');
  });

  // ─── 4. settingsStore Persistence Integration ───────────────────────────────

  it('saves theme into settingsStore and synchronizes across sessions', async () => {
    await manager.saveTheme('light-daltonized');

    expect(manager.themeName).toBe('light-daltonized');
    expect(manager.themeSetting).toBe('light-daltonized');

    // Verify written to settingsStore
    const loadedSettings = await settingsStore.load();
    expect(loadedSettings.theme).toBe('light-daltonized');

    // Verify another manager instance can load from settings
    const anotherManager = new ThemeManager('dark');
    await anotherManager.loadFromSettings();
    expect(anotherManager.themeName).toBe('light-daltonized');
    expect(anotherManager.getColor('success')).toBe('rgb(0,102,153)');
  });

  // ─── 5. Standalone Convenience Helpers ──────────────────────────────────────

  it('exports convenient top-level helpers', async () => {
    setTheme('dark-ansi');
    expect(themeManager.themeName).toBe('dark-ansi');
    expect(getThemeColor('autoAccept')).toBe('ansi:magentaBright');

    await saveTheme('light');
    expect(themeManager.themeName).toBe('light');
    const settings = await settingsStore.load();
    expect(settings.theme).toBe('light');
  });

  it('lists theme names and settings', () => {
    expect(manager.listThemeNames()).toEqual(THEME_NAMES);
    expect(manager.listThemeSettings()).toEqual(THEME_SETTINGS);
  });

  // ─── 6. ANSI Color Converter ────────────────────────────────────────────────

  it('converts rgb and ansi color tokens to terminal escape sequences', () => {
    const rgbAnsi = themeColorToAnsi('rgb(215,119,87)');
    expect(rgbAnsi).toBe('\x1b[38;2;215;119;87m');

    const ansiNamed = themeColorToAnsi('ansi:redBright');
    expect(ansiNamed).toBe('\x1b[91m');

    const fallback = themeColorToAnsi('unknown');
    expect(fallback).toBe('\x1b[39m');
  });
});
