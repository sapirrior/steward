import { describe, expect, it } from 'bun:test';
import { Box, Newline, renderElement, Spacer, Text, Transform } from './index.js';
import { jsx, jsxs, Fragment } from '../reconciler/element.js';

describe('Declarative Elements Suite (src/elements)', () => {
  describe('<Box>', () => {
    it('renders text with borders and padding', () => {
      const el = jsx(Box, {
        borderStyle: 'single',
        borderColor: 'cyan',
        padding: 1,
        children: jsx(Text, { color: 'white', children: 'Hello World' }),
      });

      const lines = renderElement(el, { width: 30, colorLevel: 0 });
      expect(lines.length).toBeGreaterThan(2);
      expect(lines[0]).toContain('┌');
      expect(lines[0]).toContain('┐');
      expect(lines[lines.length - 1]).toContain('└');
      expect(lines[lines.length - 1]).toContain('┘');
      expect(lines.some((l) => l.includes('Hello World'))).toBe(true);
    });

    it('renders row layout with multiple children', () => {
      const el = jsxs(Box, {
        flexDirection: 'row',
        children: [jsx(Text, { children: 'Left' }), jsx(Text, { children: 'Right' })],
      });

      const lines = renderElement(el, { width: 40, colorLevel: 0 });
      expect(lines[0]).toContain('Left');
      expect(lines[0]).toContain('Right');
    });

    it('handles width percentages and margins', () => {
      const el = jsx(Box, {
        width: '50%',
        margin: 1,
        children: jsx(Text, { children: 'Margin Content' }),
      });

      const lines = renderElement(el, { width: 40, colorLevel: 0 });
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some((l) => l.includes('Margin Content'))).toBe(true);
    });

    it('supports border background colors and per-side dimming', () => {
      const el = jsx(Box, {
        borderStyle: 'single',
        borderColor: 'cyan',
        borderBackgroundColor: 'blue',
        borderTopDimColor: true,
        children: jsx(Text, { children: 'Border Bg' }),
      });

      const lines = renderElement(el, { width: 20, colorLevel: 3 });
      expect(lines.length).toBeGreaterThan(2);
      // ANSI escape codes for border styling should be present
      expect(lines[0]).toContain('\x1b[');
    });
  });

  describe('<Text>', () => {
    it('cascades inherited background color from parent container', () => {
      const el = jsx(Box, {
        backgroundColor: 'blue',
        children: jsx(Text, { color: 'white', children: 'Inherited Text' }),
      });

      const lines = renderElement(el, { width: 30, colorLevel: 3 });
      expect(lines[0]).toContain('Inherited Text');
      expect(lines[0]).toContain('\x1b[');
    });

    it('applies text styling (bold, color, inverse)', () => {
      const el = jsx(Text, {
        bold: true,
        color: 'green',
        inverse: true,
        children: 'Styled Text',
      });

      const lines = renderElement(el, { width: 40, colorLevel: 3 });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('Styled Text');
      expect(lines[0]).toContain('\x1b[');
    });

    it('wraps long text across multiple lines', () => {
      const longText =
        'This is a very long text string that should wrap into multiple lines cleanly.';
      const el = jsx(Text, { wrap: 'wrap', children: longText });

      const lines = renderElement(el, { width: 20, colorLevel: 0 });
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.every((l) => l.length <= 20)).toBe(true);
    });

    it('truncates text according to truncate mode', () => {
      const longText = 'Supercalifragilisticexpialidocious';
      const el = jsx(Text, { wrap: 'truncate-end', children: longText });

      const lines = renderElement(el, { width: 10, colorLevel: 0 });
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain('…');
    });
  });

  describe('<Spacer>', () => {
    it('expands flex space between items in row mode', () => {
      const el = jsxs(Box, {
        flexDirection: 'row',
        width: 30,
        children: [
          jsx(Text, { children: 'Start' }),
          jsx(Spacer, {}),
          jsx(Text, { children: 'End' }),
        ],
      });

      const lines = renderElement(el, { width: 30, colorLevel: 0 });
      expect(lines[0].startsWith('Start')).toBe(true);
      expect(lines[0].trimEnd().endsWith('End')).toBe(true);
    });
  });

  describe('<Newline>', () => {
    it('inserts the specified number of blank lines', () => {
      const el = jsxs(Box, {
        flexDirection: 'column',
        children: [
          jsx(Text, { children: 'Line 1' }),
          jsx(Newline, { count: 2 }),
          jsx(Text, { children: 'Line 2' }),
        ],
      });

      const lines = renderElement(el, { width: 30, colorLevel: 0 });
      expect(lines.length).toBe(4);
      expect(lines[0]).toContain('Line 1');
      expect(lines[1].trim()).toBe('');
      expect(lines[2].trim()).toBe('');
      expect(lines[3]).toContain('Line 2');
    });
  });

  describe('<Transform>', () => {
    it('transforms output text through transform callback', () => {
      const el = jsx(Transform, {
        transform: (output: string) => output.toUpperCase(),
        children: jsx(Text, { children: 'hello world' }),
      });

      const lines = renderElement(el, { width: 30, colorLevel: 0 });
      expect(lines[0]).toBe('HELLO WORLD');
    });
  });

  describe('<Fragment>', () => {
    it('renders multiple children seamlessly without container', () => {
      const el = jsx(Box, {
        flexDirection: 'column',
        children: jsx(Fragment, {
          children: [jsx(Text, { children: 'Item A' }), jsx(Text, { children: 'Item B' })],
        }),
      });

      const lines = renderElement(el, { width: 30, colorLevel: 0 });
      expect(lines).toEqual(['Item A', 'Item B']);
    });
  });
});
