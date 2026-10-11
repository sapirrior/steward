/**
 * @file Markdown.test.ts
 * @description Unit tests for markdown rendering matching Claude Code.
 */

import { describe, it, expect } from 'bun:test';
import { applyMarkdown } from '../../utils/markdown.js';

describe('Markdown rendering', () => {
  it('formats inline code with permission color token', () => {
    const input = 'Use `bun test` to run tests.';
    const output = applyMarkdown(input, 'dark');
    expect(output).toContain('\x1b[38;2;177;185;249mbun test\x1b[39m');
  });

  it('formats headings with bold styling', () => {
    const input = '## Installation';
    const output = applyMarkdown(input, 'dark');
    expect(output).toContain('Installation');
    expect(output).toContain('\x1b[1m');
  });

  it('formats blockquotes with blockquote bar', () => {
    const input = '> Note: this is important';
    const output = applyMarkdown(input, 'dark');
    expect(output).toContain('▎');
    expect(output).toContain('Note: this is important');
  });

  it('formats lists with bullet dashes or numbers', () => {
    const input = '- Item 1\n- Item 2';
    const output = applyMarkdown(input, 'dark');
    expect(output).toContain('- Item 1');
    expect(output).toContain('- Item 2');
  });

  it('formats markdown tables with aligned borders', () => {
    const input = '| Command | Description |\n|---|---|\n| `bun run dev` | Dev server |';
    const output = applyMarkdown(input, 'dark');
    expect(output).toContain('| Command');
    expect(output).toContain('| Description');
    expect(output).toContain('|---------');
  });
});
