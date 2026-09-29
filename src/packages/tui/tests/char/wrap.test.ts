import { describe, expect, test } from 'bun:test';
import { wrapVisualLine, wrapVisualLineWithCursor } from '../../src/engine/cell-layout.js';

describe('Characterization: wrapVisualLine', () => {
  test('ASCII text wrapping at word boundaries', () => {
    const text = 'hello world from steward terminal assistant';
    const wrapped = wrapVisualLine(text, 15);
    expect(wrapped).toEqual(['hello world ', 'from steward ', 'terminal ', 'assistant']);
  });

  test('CJK characters width handling', () => {
    const text = '你好世界测试终端';
    const wrapped = wrapVisualLine(text, 8);
    expect(wrapped).toEqual(['你好世界', '测试终端']);
  });

  test('Single word longer than max width breaks across lines', () => {
    const text = 'supercalifragilisticexpialidocious';
    const wrapped = wrapVisualLine(text, 10);
    expect(wrapped).toEqual(['supercalif', 'ragilistic', 'expialidoc', 'ious']);
  });

  test('Hanging indent with numeric spaces', () => {
    const text = 'Item 1: This is a detailed description that should wrap with hanging indent';
    const wrapped = wrapVisualLine(text, 25, 4);
    expect(wrapped[0]).toBe('Item 1: This is a ');
    expect(wrapped[1]?.startsWith('    ')).toBe(true);
  });

  test('Hanging indent with custom string prefix', () => {
    const text = 'Bullet: First line of content that will continue on next line';
    const wrapped = wrapVisualLine(text, 25, '  > ');
    expect(wrapped[0]).toBe('Bullet: First line of ');
    expect(wrapped[1]?.startsWith('  > ')).toBe(true);
  });

  test('ANSI background color continuation across wraps', () => {
    const text = '\x1b[44mBlue background text that should wrap to second line\x1b[0m';
    const wrapped = wrapVisualLine(text, 20);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped[0]).toContain('\x1b[44m');
    expect(wrapped[1]).toContain('\x1b[44m');
  });

  test('Cursor offset mapping in wrapped line', () => {
    const text = 'hello world again';
    // Offset at 'w' in 'world' (index 6)
    const result = wrapVisualLineWithCursor(text, 8, 6);
    expect(result.segments).toEqual(['hello ', 'world ', 'again']);
    expect(result.cursorInLine).toEqual({
      segmentIndex: 1,
      column: 1,
    });
  });
});
