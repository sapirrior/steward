import { describe, expect, test } from 'bun:test';
import { Box } from '../../src/primitives/Box.js';
import { Text } from '../../src/primitives/Text.js';

describe('Step 2.5: Pure Text and Box Primitives', () => {
  test('Text styling with color and formatting', () => {
    const el = Text('Styled Hello', {
      color: 'red',
      bold: true,
      backgroundColor: 'blue',
    });
    const rendered = el.render(40);
    expect(rendered.length).toBe(1);
    expect(rendered[0]).toContain('\x1b[31m');
    expect(rendered[0]).toContain('\x1b[44m');
    expect(rendered[0]).toContain('\x1b[1m');
  });

  test('Box with string borderColor does not throw ReferenceError (D1 fix)', () => {
    const box = Box(
      {
        border: 'rounded',
        borderColor: 'green',
        padding: 1,
      },
      [Text('Inside Box')],
    );

    const rendered = box.render(30);
    expect(rendered.length).toBeGreaterThan(2);
    // Contains rounded corner characters and green color
    expect(rendered[0]).toContain('╭');
    expect(rendered[0]).toContain('\x1b[32m');
  });

  test('Box with function borderColor applies custom styling', () => {
    const box = Box(
      {
        border: 'single',
        borderColor: (s) => `[${s}]`,
      },
      [Text('Content')],
    );

    const rendered = box.render(20);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered[0]?.startsWith('[┌')).toBe(true);
  });
});
