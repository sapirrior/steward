import { describe, expect, test } from 'bun:test';
import { visibleWidth, expandTabs } from '../../src/text/width.js';
import { truncate } from '../../src/text/truncate.js';
import { sanitize } from '../../src/text/sanitize.js';

describe('Phase 3: Text Math, Graphemes, Sanitizer and Truncate', () => {
  test('Grapheme widths: Emoji sequences, flags, combining marks, CJK', () => {
    expect(visibleWidth('👨‍👩‍👧')).toBe(2);
    expect(visibleWidth('🇯🇵')).toBe(2);
    expect(visibleWidth('e\u0301')).toBe(1); // e + combining acute
    expect(visibleWidth('漢字')).toBe(4);
    expect(visibleWidth('❤️')).toBe(2); // Heart with VS16
  });

  test('Tab expansion expands to 4-space tab stops', () => {
    expect(expandTabs('a\tb')).toBe('a   b');
    expect(expandTabs('abcd\te')).toBe('abcd    e');
    expect(expandTabs('\txyz')).toBe('    xyz');
  });

  test('Truncation modes with ellipsis', () => {
    const text = 'Hello World';
    expect(truncate(text, 7, { mode: 'end', ellipsis: '…' })).toBe('Hello …');
    expect(truncate(text, 7, { mode: 'start', ellipsis: '…' })).toBe('… World');
    expect(truncate(text, 7, { mode: 'middle', ellipsis: '…' })).toBe('Hel…rld');
  });

  test('Sanitizer drops malicious terminal escape injections', () => {
    // OSC 52 clipboard write, OSC 0 title change, clear screen, mode 1049
    const hostile = 'SafeText\x1b]52;c;SGVsbG8=\x07\x1b[2J\x1b]0;Title\x07\x1b[?1049h\x1b[31mRedText\x1b[0m';
    const sanitized = sanitize(hostile);

    expect(sanitized).not.toContain('\x1b]52');
    expect(sanitized).not.toContain('\x1b[2J');
    expect(sanitized).not.toContain('\x1b]0;');
    expect(sanitized).not.toContain('\x1b[?1049h');
    // Keeps safe SGR colors and safe printable text
    expect(sanitized).toContain('SafeText');
    expect(sanitized).toContain('\x1b[31mRedText\x1b[0m');
  });
});
