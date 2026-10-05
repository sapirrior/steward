import { describe, it, expect } from 'bun:test';
import chalk from 'chalk';
import {
  c,
  bg,
  bold,
  italic,
  underline,
  resolveThemeColor,
  darkTheme,
  getHighlightTheme,
  buildHighlightTheme,
} from '../src/theme/index.js';

describe('CLI Theme Machinery (S6)', () => {
  it('exposes all declared foreground color tokens', () => {
    const tokens = [
      'text',
      'muted',
      'subtle',
      'brand',
      'info',
      'success',
      'warning',
      'error',
      'permission',
      'selected',
      'current',
      'promptBorder',
      'rule',
      'userChevron',
      'diffAddFg',
      'diffDelFg',
    ] as const;

    for (const token of tokens) {
      expect(typeof c[token]).toBe('function');
      const formatted = c[token]('test');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('test');
    }
  });

  it('exposes all declared background tokens', () => {
    const tokens = ['userBg', 'diffAddBg', 'diffDelBg'] as const;

    for (const token of tokens) {
      expect(typeof bg[token]).toBe('function');
      const formatted = bg[token]('test');
      expect(typeof formatted).toBe('string');
      expect(formatted).toContain('test');
    }
  });

  it('resolveThemeColor resolves rgb, hex and handles level 0 identity', () => {
    const rgbFn = resolveThemeColor('rgb(255,100,50)', false);
    expect(typeof rgbFn).toBe('function');
    expect(rgbFn('hello')).toContain('hello');

    const hexFn = resolveThemeColor('#ff7b72', false);
    expect(typeof hexFn).toBe('function');
    expect(hexFn('hello')).toContain('hello');

    const defaultFn = resolveThemeColor('default', false);
    expect(defaultFn('identity')).toBe('identity');
  });

  it('buildHighlightTheme builds a valid highlight theme from darkTheme', () => {
    const theme = buildHighlightTheme(darkTheme);
    expect(typeof theme.keyword).toBe('function');
    expect(typeof theme.string).toBe('function');
    expect(typeof theme.comment).toBe('function');
  });

  it('getHighlightTheme returns identity in level 0', () => {
    const prevLevel = chalk.level;
    try {
      chalk.level = 0 as any;
      const theme = getHighlightTheme();
      expect(typeof theme.default).toBe('function');
      expect(theme.default!('code')).toBe('code');
    } finally {
      chalk.level = prevLevel;
    }
  });
});
