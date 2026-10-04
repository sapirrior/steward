import { describe, it, expect } from 'bun:test';
import { visibleColumnAtOffset, visibleWidth } from '../../src/text/width.js';
import { wrapVisualLineWithCursor } from '../../src/text/wrap.js';
import { measureNode } from '../../src/engine/layout.js';
import type { ComponentNode } from '../../src/engine/DocumentTree.js';

describe('Cursor Math Normalization (Reason B)', () => {
  describe('visibleColumnAtOffset', () => {
    it('returns 1 for 0 or negative offsets and empty strings', () => {
      expect(visibleColumnAtOffset('', 0)).toBe(1);
      expect(visibleColumnAtOffset('', 5)).toBe(1);
      expect(visibleColumnAtOffset('hello', 0)).toBe(1);
      expect(visibleColumnAtOffset('hello', -1)).toBe(1);
    });

    it('computes 1-indexed physical column for plain ASCII text', () => {
      const text = 'hello world';
      expect(visibleColumnAtOffset(text, 1)).toBe(2); // after 'h'
      expect(visibleColumnAtOffset(text, 5)).toBe(6); // after 'hello'
      expect(visibleColumnAtOffset(text, 11)).toBe(12); // after 'hello world'
    });

    it('ignores ANSI SGR sequences when computing column position', () => {
      // \x1b[32m is 5 chars, but 0 visible width
      const text = '\x1b[32mhello\x1b[0m world';
      // Logical char 1 is 'h' inside the green color
      expect(visibleColumnAtOffset(text, 1)).toBe(2);
      // Logical char 5 is 'o'
      expect(visibleColumnAtOffset(text, 5)).toBe(6);
      // Logical char 6 is ' '
      expect(visibleColumnAtOffset(text, 6)).toBe(7);
      // Logical char 11 is 'd'
      expect(visibleColumnAtOffset(text, 11)).toBe(12);
    });

    it('accurately accounts for double-width CJK characters', () => {
      const text = '你好世界';
      expect(visibleColumnAtOffset(text, 1)).toBe(3); // after '你' (width 2 -> column 1 + 2 = 3)
      expect(visibleColumnAtOffset(text, 2)).toBe(5); // after '好' (width 2 -> column 3 + 2 = 5)
      expect(visibleColumnAtOffset(text, 3)).toBe(7); // after '世' (width 2 -> column 5 + 2 = 7)
      expect(visibleColumnAtOffset(text, 4)).toBe(9); // after '界' (width 2 -> column 7 + 2 = 9)
    });
  });

  describe('wrapVisualLineWithCursor', () => {
    it('maps cursor correctly in wrapped plain text', () => {
      // "hello world" wrapped at 6 cols -> ["hello", "world"]
      const text = 'hello world';
      const resultAtHello = wrapVisualLineWithCursor(text, 6, 3);
      expect(resultAtHello.cursorInLine).toEqual({
        segmentIndex: 0,
        column: 4, // 1 + 3 ('hel')
      });

      // Offset 8 is 'r' in "world"
      const resultAtWorld = wrapVisualLineWithCursor(text, 6, 8);
      expect(resultAtWorld.cursorInLine?.segmentIndex).toBe(1);
    });

    it('clamps cursor within [1, maxCols]', () => {
      const text = 'abcdefghij';
      const result = wrapVisualLineWithCursor(text, 5, 100);
      expect(result.cursorInLine).not.toBeNull();
      expect(result.cursorInLine!.column).toBeLessThanOrEqual(5);
      expect(result.cursorInLine!.column).toBeGreaterThanOrEqual(1);
    });
  });

  describe('measureNode non-wrapped cursor calculation', () => {
    it('uses visibleColumnAtOffset and clamps to contentWidth when unwrapped', () => {
      const node: ComponentNode = {
        id: 'input-node',
        getLines: () => ['\x1b[1;34mPrompt:\x1b[0m user input text here'],
        getLogicalCursor: () => ({
          logicalLineIndex: 0,
          characterOffsetWithinLine: 8, // 'Prompt: ' is 8 chars
        }),
        wrap: false,
        clip: false,
      };

      const { rows, cursorWithinNode } = measureNode(node, 80);
      expect(rows.length).toBe(1);
      expect(cursorWithinNode).toEqual({
        row: 0,
        column: 9, // 1-indexed: 1 + 8 visible chars = 9
      });
    });

    it('clamps column to contentWidth if offset exceeds width', () => {
      const node: ComponentNode = {
        id: 'overflow-node',
        getLines: () => ['very long line of text that exceeds maximum content width'],
        getLogicalCursor: () => ({
          logicalLineIndex: 0,
          characterOffsetWithinLine: 50,
        }),
        wrap: false,
        clip: true,
      };

      const contentWidth = 20;
      const { cursorWithinNode } = measureNode(node, contentWidth);
      expect(cursorWithinNode).toEqual({
        row: 0,
        column: contentWidth,
      });
    });
  });
});
