import { describe, it, expect } from 'bun:test';
import {
  darkTheme,
  lightTheme,
  draculaTheme,
  darkAnsiTheme,
  lightAnsiTheme,
  darkColorblindTheme,
  lightColorblindTheme,
  getTheme,
  setActiveTheme,
  getActiveThemeName,
  listThemes,
  findTheme,
  THEMES,
  type ThemeName,
} from '../../src/theme/colors.js';
import { resolveThemeColor } from '../../src/theme/apply.js';

describe('Theme Alignment & Palette Tests', () => {
  it('aligns darkTheme colors with default dark palette specifications', () => {
    expect(darkTheme.promptBorder).toBe('rgb(136,136,136)');
    expect(darkTheme.userCardBg).toBe('rgb(55,55,55)');
    expect(darkTheme.brand).toBe('rgb(215,119,87)');
    expect(darkTheme.brandShimmer).toBe('rgb(235,159,127)');
    expect(darkTheme.permission).toBe('rgb(177,185,249)');
    expect(darkTheme.bashPink).toBe('rgb(253,93,177)');
    expect(darkTheme.success).toBe('rgb(78,186,101)');
    expect(darkTheme.error).toBe('rgb(255,107,128)');
    expect(darkTheme.warning).toBe('rgb(255,193,7)');
    expect(darkTheme.text).toBe('rgb(255,255,255)');
    expect(darkTheme.subtle).toBe('rgb(80,80,80)');
    expect(darkTheme.inactive).toBe('rgb(153,153,153)');
  });

  it('aligns draculaTheme with official Dracula specification', () => {
    expect(draculaTheme.brand).toBe('rgb(255,184,108)');
    expect(draculaTheme.permission).toBe('rgb(189,147,249)');
    expect(draculaTheme.success).toBe('rgb(80,250,123)');
    expect(draculaTheme.error).toBe('rgb(255,85,85)');
    expect(draculaTheme.info).toBe('rgb(139,233,253)');
    expect(draculaTheme.text).toBe('rgb(248,248,242)');
  });

  it('aligns dark-ansi and light-ansi with 16-color ANSI grammar', () => {
    expect(darkAnsiTheme.brand).toBe('ansi(yellow)');
    expect(darkAnsiTheme.success).toBe('ansi(green)');
    expect(darkAnsiTheme.error).toBe('ansi(red)');
    expect(darkAnsiTheme.diffAddBG).toBe('ansi(reset)');
    expect(darkAnsiTheme.diffDeleteBG).toBe('ansi(reset)');

    expect(lightAnsiTheme.brand).toBe('ansi(yellow)');
    expect(lightAnsiTheme.success).toBe('ansi(green)');
    expect(lightAnsiTheme.error).toBe('ansi(red)');
    expect(lightAnsiTheme.text).toBe('ansi(black)');
  });

  it('aligns dark-colorblind and light-colorblind with Okabe-Ito palette', () => {
    expect(darkColorblindTheme.success).toBe('rgb(0,158,115)'); // Bluish Green
    expect(darkColorblindTheme.error).toBe('rgb(213,94,0)'); // Vermillion
    expect(darkColorblindTheme.warning).toBe('rgb(230,159,0)'); // Orange
    expect(darkColorblindTheme.brand).toBe('rgb(86,180,233)'); // Sky Blue

    expect(lightColorblindTheme.success).toBe('rgb(0,158,115)');
    expect(lightColorblindTheme.error).toBe('rgb(213,94,0)');
    expect(lightColorblindTheme.brand).toBe('rgb(0,114,178)'); // Blue
  });

  it('returns active theme from getTheme and switches dynamically', () => {
    setActiveTheme('dark');
    expect(getActiveThemeName()).toBe('dark');
    expect(getTheme().brand).toBe(darkTheme.brand);

    setActiveTheme('dracula');
    expect(getActiveThemeName()).toBe('dracula');
    expect(getTheme().brand).toBe(draculaTheme.brand);

    // Reset back to dark
    setActiveTheme('dark');
    expect(getActiveThemeName()).toBe('dark');
  });

  it('safely ignores invalid theme names without throwing or corrupting state', () => {
    setActiveTheme('dark');
    setActiveTheme('invalid-non-existent-theme' as ThemeName);
    expect(getActiveThemeName()).toBe('dark');
    expect(getTheme()).toBe(darkTheme);
  });

  it('ensures all 7 themes in registry populate every single UITheme key', () => {
    const requiredKeys = Object.keys(darkTheme) as (keyof typeof darkTheme)[];
    expect(requiredKeys.length).toBe(29);

    const themes = listThemes();
    expect(themes.length).toBe(7);

    for (const themeMeta of themes) {
      for (const key of requiredKeys) {
        const val = themeMeta.theme[key];
        expect(val).toBeDefined();
        expect(typeof val).toBe('string');
        expect(val.length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves ansi(name), rgb(r,g,b), and hex colors into chalk formatters', () => {
    const ansiColor = resolveThemeColor('ansi(green)');
    expect(typeof ansiColor).toBe('function');
    const ansiBg = resolveThemeColor('ansi(bgGreen)', true);
    expect(typeof ansiBg).toBe('function');

    const rgbColor = resolveThemeColor('rgb(215,119,87)');
    expect(typeof rgbColor).toBe('function');

    const hexColor = resolveThemeColor('#D77757');
    expect(typeof hexColor).toBe('function');
  });

  it('finds themes by exact name, label, or prefix', () => {
    expect(findTheme('dark')?.name).toBe('dark');
    expect(findTheme('dracula')?.name).toBe('dracula');
    expect(findTheme('Dark (Default)')?.name).toBe('dark');
    expect(findTheme('dark-ansi')?.name).toBe('dark-ansi');
    expect(findTheme('light-colorblind')?.name).toBe('light-colorblind');
    expect(findTheme('drac')?.name).toBe('dracula');
    expect(findTheme('nonexistent')).toBeUndefined();
    expect(findTheme('')).toBeUndefined();
  });
});
