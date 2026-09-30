import { describe, it, expect } from 'bun:test';
import {
  darkTheme,
  lightTheme,
  draculaTheme,
  darkDaltonizedTheme,
  lightDaltonizedTheme,
  darkAnsiTheme,
  lightAnsiTheme,
  noColorTheme,
  getTheme,
  setActiveTheme,
  getActiveThemeName,
  listThemes,
  findTheme,
  type ThemeName,
} from '../../src/theme/colors.js';
import { resolveThemeColor } from '../../src/theme/apply.js';
import { c, bg, bold, italic } from '../../src/theme/style.js';

describe('Theme Subsystem Tests', () => {
  it('aligns darkTheme semantic tokens with default palette', () => {
    expect(darkTheme.promptBorder).toBe('rgb(136,136,136)');
    expect(darkTheme.userBg).toBe('rgb(55,55,55)');
    expect(darkTheme.brand).toBe('rgb(215,119,87)');
    expect(darkTheme.permission).toBe('rgb(177,185,249)');
    expect(darkTheme.success).toBe('rgb(78,186,101)');
    expect(darkTheme.error).toBe('rgb(255,107,128)');
    expect(darkTheme.warning).toBe('rgb(255,193,7)');
    expect(darkTheme.text).toBe('rgb(255,255,255)');
    expect(darkTheme.subtle).toBe('rgb(80,80,80)');
  });

  it('aligns darkDaltonizedTheme and lightDaltonizedTheme with 1:1 color-blind specifications', () => {
    expect(darkDaltonizedTheme.brand).toBe('rgb(255,153,51)');
    expect(darkDaltonizedTheme.permission).toBe('rgb(153,204,255)');
    expect(darkDaltonizedTheme.success).toBe('rgb(51,153,255)');
    expect(darkDaltonizedTheme.error).toBe('rgb(255,102,102)');
    expect(darkDaltonizedTheme.warning).toBe('rgb(255,204,0)');
    expect(darkDaltonizedTheme.diffAddBg).toBe('rgb(0,68,102)');
    expect(darkDaltonizedTheme.diffDelBg).toBe('rgb(102,0,0)');

    expect(lightDaltonizedTheme.brand).toBe('rgb(255,153,51)');
    expect(lightDaltonizedTheme.permission).toBe('rgb(51,102,255)');
    expect(lightDaltonizedTheme.success).toBe('rgb(0,102,153)');
    expect(lightDaltonizedTheme.error).toBe('rgb(204,0,0)');
    expect(lightDaltonizedTheme.diffAddBg).toBe('rgb(153,204,255)');
    expect(lightDaltonizedTheme.diffDelBg).toBe('rgb(255,204,204)');
  });

  it('aligns noColorTheme with monochrome pure white specification', () => {
    expect(noColorTheme.text).toBe('rgb(255,255,255)');
    expect(noColorTheme.brand).toBe('rgb(255,255,255)');
    expect(noColorTheme.info).toBe('rgb(255,255,255)');
    expect(noColorTheme.success).toBe('rgb(255,255,255)');
    expect(noColorTheme.warning).toBe('rgb(255,255,255)');
    expect(noColorTheme.error).toBe('rgb(255,255,255)');
    expect(noColorTheme.permission).toBe('rgb(255,255,255)');
    expect(noColorTheme.userBg).toBe('default');
    expect(noColorTheme.diffAddBg).toBe('default');
    expect(noColorTheme.diffDelBg).toBe('default');
    expect(noColorTheme.syntax.keyword).toBe('rgb(255,255,255)');
    expect(noColorTheme.syntax.string).toBe('rgb(255,255,255)');
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
    expect(darkAnsiTheme.brand).toBe('ansi(redBright)');
    expect(darkAnsiTheme.success).toBe('ansi(greenBright)');
    expect(darkAnsiTheme.error).toBe('ansi(redBright)');
    expect(darkAnsiTheme.diffAddBg).toBe('default');
    expect(darkAnsiTheme.diffDelBg).toBe('default');

    expect(lightAnsiTheme.brand).toBe('ansi(redBright)');
    expect(lightAnsiTheme.success).toBe('ansi(green)');
    expect(lightAnsiTheme.error).toBe('ansi(red)');
    expect(lightAnsiTheme.text).toBe('ansi(black)');
  });

  it('returns active theme from getTheme and switches dynamically', () => {
    setActiveTheme('dark');
    expect(getActiveThemeName()).toBe('dark');
    expect(getTheme().brand).toBe(darkTheme.brand);

    setActiveTheme('dracula');
    expect(getActiveThemeName()).toBe('dracula');
    expect(getTheme().brand).toBe(draculaTheme.brand);

    setActiveTheme('dark-daltonized');
    expect(getActiveThemeName()).toBe('dark-daltonized');
    expect(getTheme().brand).toBe(darkDaltonizedTheme.brand);

    // Reset back to dark
    setActiveTheme('dark');
    expect(getActiveThemeName()).toBe('dark');
  });

  it('safely handles unknown theme names without throwing or crashing', () => {
    setActiveTheme('dark');
    const res = setActiveTheme('invalid-non-existent-theme' as ThemeName);
    expect(res).toBe(false);
    expect(getActiveThemeName()).toBe('dark');
    expect(getTheme()).toBe(darkTheme);
  });

  it('ensures all 8 registered themes populate every semantic UITheme key', () => {
    const requiredKeys = Object.keys(darkTheme) as (keyof typeof darkTheme)[];
    expect(requiredKeys.length).toBeGreaterThanOrEqual(18);

    const themes = listThemes();
    expect(themes.length).toBe(8);

    for (const themeMeta of themes) {
      for (const key of requiredKeys) {
        const val = themeMeta.theme[key];
        expect(val).toBeDefined();
        if (key === 'syntax') {
          expect(typeof val).toBe('object');
          expect((val as any).keyword).toBeDefined();
        } else {
          expect(typeof val).toBe('string');
          expect((val as string).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('resolves ansi(name), rgb(r,g,b), and hex colors into formatters', () => {
    const ansiColor = resolveThemeColor('ansi(green)');
    expect(typeof ansiColor).toBe('function');
    const ansiBg = resolveThemeColor('ansi(bgGreen)', true);
    expect(typeof ansiBg).toBe('function');

    const rgbColor = resolveThemeColor('rgb(215,119,87)');
    expect(typeof rgbColor).toBe('function');

    const hexColor = resolveThemeColor('#D77757');
    expect(typeof hexColor).toBe('function');
  });

  it('provides style proxy tokens (c.*, bg.*, bold, italic)', () => {
    expect(typeof c.brand).toBe('function');
    expect(typeof c.text).toBe('function');
    expect(typeof bg.userBg).toBe('function');
    expect(typeof bold).toBe('function');
    expect(typeof italic).toBe('function');
  });

  it('finds themes by exact name, label, or prefix', () => {
    expect(findTheme('dark')?.name).toBe('dark');
    expect(findTheme('dracula')?.name).toBe('dracula');
    expect(findTheme('Dark (Default)')?.name).toBe('dark');
    expect(findTheme('dark-ansi')?.name).toBe('dark-ansi');
    expect(findTheme('light-ansi')?.name).toBe('light-ansi');
    expect(findTheme('dark-daltonized')?.name).toBe('dark-daltonized');
    expect(findTheme('Dark Daltonized')?.name).toBe('dark-daltonized');
    expect(findTheme('light-daltonized')?.name).toBe('light-daltonized');
    expect(findTheme('no-color')?.name).toBe('no-color');
    expect(findTheme('no color')?.name).toBe('no-color');
    expect(findTheme('No Color')?.name).toBe('no-color');
    expect(findTheme('drac')?.name).toBe('dracula');
    expect(findTheme('nonexistent')).toBeUndefined();
    expect(findTheme('')).toBeUndefined();
  });
});
