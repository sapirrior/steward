import { describe, expect, test } from 'bun:test';
import { ScreenBuffer } from '../../src/layout/ScreenBuffer.js';

describe('Characterization: ScreenBuffer', () => {
  test('blitText with simple string and getRow', () => {
    const buffer = new ScreenBuffer(20, 5);
    buffer.blitText(2, 1, 20, 'hello world');
    expect(buffer.getRow(1)).toBe('  hello world');
    expect(buffer.getRow(0)).toBe('');
  });

  test('blitText with wide CJK character', () => {
    const buffer = new ScreenBuffer(10, 2);
    buffer.blitText(0, 0, 10, '中x文');
    expect(buffer.getRow(0)).toBe('中x文');
  });

  test('diff computes row changes between two buffers', () => {
    const prev = new ScreenBuffer(20, 3);
    prev.blitText(0, 0, 20, 'Line 1');
    prev.blitText(0, 1, 20, 'Line 2');
    prev.blitText(0, 2, 20, 'Line 3');

    const next = new ScreenBuffer(20, 3);
    next.blitText(0, 0, 20, 'Line 1');
    next.blitText(0, 1, 20, 'Line 2 CHANGED');
    next.blitText(0, 2, 20, 'Line 3');

    const diffs = next.diff(prev);
    expect(diffs).toEqual([{ row: 1, text: 'Line 2 CHANGED' }]);
  });

  test('blitText with ANSI styling preserves styles in getRow', () => {
    const buffer = new ScreenBuffer(20, 2);
    buffer.blitText(0, 0, 20, '\x1b[31mRed text\x1b[0m normal');
    const row = buffer.getRow(0);
    expect(row).toContain('\x1b[31mRed text');
  });
});
