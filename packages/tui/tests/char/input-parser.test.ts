import { describe, expect, test } from 'bun:test';
import { InputParser, makeKey } from '../../src/terminal/input.js';

describe('Phase 2: Central Stateful InputParser', () => {
  test('Standard arrows and simple navigation keys', () => {
    const parser = new InputParser();

    // Plain arrows
    let evs = parser.feed('\x1b[A\x1b[B\x1b[C\x1b[D');
    expect(evs).toHaveLength(4);
    expect(evs[0]).toEqual({ type: 'key', input: '', key: makeKey('up') });
    expect(evs[1]).toEqual({ type: 'key', input: '', key: makeKey('down') });
    expect(evs[2]).toEqual({ type: 'key', input: '', key: makeKey('right') });
    expect(evs[3]).toEqual({ type: 'key', input: '', key: makeKey('left') });

    // SS3 arrows
    evs = parser.feed('\x1bOA\x1bOB\x1bOC\x1bOD');
    expect(evs).toHaveLength(4);
    expect(evs[0]).toEqual({ type: 'key', input: '', key: makeKey('up') });
    expect(evs[1]).toEqual({ type: 'key', input: '', key: makeKey('down') });
    expect(evs[2]).toEqual({ type: 'key', input: '', key: makeKey('right') });
    expect(evs[3]).toEqual({ type: 'key', input: '', key: makeKey('left') });
  });

  test('Modified arrows across all modifier codes 2-8', () => {
    const parser = new InputParser();

    // 2 = Shift, 3 = Alt, 4 = Shift+Alt, 5 = Ctrl, 6 = Shift+Ctrl, 7 = Alt+Ctrl, 8 = Shift+Alt+Ctrl
    const cases = [
      { seq: '\x1b[1;2A', name: 'up', mods: { shift: true } },
      { seq: '\x1b[1;3B', name: 'down', mods: { meta: true } },
      { seq: '\x1b[1;4C', name: 'right', mods: { shift: true, meta: true } },
      { seq: '\x1b[1;5D', name: 'left', mods: { ctrl: true } },
      { seq: '\x1b[1;6A', name: 'up', mods: { shift: true, ctrl: true } },
      { seq: '\x1b[1;7B', name: 'down', mods: { meta: true, ctrl: true } },
      { seq: '\x1b[1;8C', name: 'right', mods: { shift: true, meta: true, ctrl: true } },
    ];

    for (const c of cases) {
      parser.reset();
      const evs = parser.feed(c.seq);
      expect(evs).toHaveLength(1);
      expect(evs[0]).toEqual({ type: 'key', input: '', key: makeKey(c.name, c.mods) });
    }
  });

  test('Home, End, PageUp, PageDown, Delete, Insert, and F1-F12', () => {
    const parser = new InputParser();

    const cases = [
      { seq: '\x1b[H', name: 'home' },
      { seq: '\x1b[F', name: 'end' },
      { seq: '\x1b[1~', name: 'home' },
      { seq: '\x1b[4~', name: 'end' },
      { seq: '\x1b[7~', name: 'home' },
      { seq: '\x1b[8~', name: 'end' },
      { seq: '\x1b[2~', name: 'insert' },
      { seq: '\x1b[3~', name: 'delete' },
      { seq: '\x1b[5~', name: 'pageup' },
      { seq: '\x1b[6~', name: 'pagedown' },
      { seq: '\x1b[5;2~', name: 'pageup', mods: { shift: true } },
      { seq: '\x1b[6;5~', name: 'pagedown', mods: { ctrl: true } },
      { seq: '\x1bOP', name: 'f1' },
      { seq: '\x1bOQ', name: 'f2' },
      { seq: '\x1bOR', name: 'f3' },
      { seq: '\x1bOS', name: 'f4' },
      { seq: '\x1b[15~', name: 'f5' },
      { seq: '\x1b[17~', name: 'f6' },
      { seq: '\x1b[18~', name: 'f7' },
      { seq: '\x1b[19~', name: 'f8' },
      { seq: '\x1b[20~', name: 'f9' },
      { seq: '\x1b[21~', name: 'f10' },
      { seq: '\x1b[23~', name: 'f11' },
      { seq: '\x1b[24~', name: 'f12' },
      { seq: '\x1b[Z', name: 'tab', mods: { shift: true } },
    ];

    for (const c of cases) {
      parser.reset();
      const evs = parser.feed(c.seq);
      expect(evs).toHaveLength(1);
      expect(evs[0]).toEqual({ type: 'key', input: '', key: makeKey(c.name, c.mods) });
    }
  });

  test('CSI-u encoding', () => {
    const parser = new InputParser();

    // 'a' = 97
    let evs = parser.feed('\x1b[97u');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({ type: 'key', input: 'a', key: makeKey('a') });

    // Ctrl+'a' = 97;5u -> chord has input: ''
    parser.reset();
    evs = parser.feed('\x1b[97;5u');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({ type: 'key', input: '', key: makeKey('a', { ctrl: true }) });
  });

  test('SGR Mouse decoding (wheel, clicks, motion, modifiers)', () => {
    const parser = new InputParser();

    // Wheel up at col 10, row 5
    let evs = parser.feed('\x1b[<64;10;5M');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({
      type: 'mouse',
      action: 'wheel',
      button: 'wheelUp',
      col: 10,
      row: 5,
      shift: false,
      meta: false,
      ctrl: false,
    });

    // Wheel down with Shift (65 + 4 = 69)
    parser.reset();
    evs = parser.feed('\x1b[<69;12;20M');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({
      type: 'mouse',
      action: 'wheel',
      button: 'wheelDown',
      col: 12,
      row: 20,
      shift: true,
      meta: false,
      ctrl: false,
    });

    // Left click press
    parser.reset();
    evs = parser.feed('\x1b[<0;30;40M');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({
      type: 'mouse',
      action: 'press',
      button: 'left',
      col: 30,
      row: 40,
      shift: false,
      meta: false,
      ctrl: false,
    });

    // Left click release
    parser.reset();
    evs = parser.feed('\x1b[<0;30;40m');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({
      type: 'mouse',
      action: 'release',
      button: 'left',
      col: 30,
      row: 40,
      shift: false,
      meta: false,
      ctrl: false,
    });

    // Motion reporting
    parser.reset();
    evs = parser.feed('\x1b[<35;50;15M');
    expect(evs).toHaveLength(1);
    expect(evs[0]).toEqual({
      type: 'mouse',
      action: 'move',
      button: 'none',
      col: 50,
      row: 15,
      shift: false,
      meta: false,
      ctrl: false,
    });
  });

  test('Focus in/out reporting and DA device attributes responses are consumed', () => {
    const parser = new InputParser();

    let evs = parser.feed('\x1b[I');
    expect(evs).toEqual([{ type: 'focus', focused: true }]);

    evs = parser.feed('\x1b[O');
    expect(evs).toEqual([{ type: 'focus', focused: false }]);

    // DA response \x1b[>0;276;0c and \x1b[?1;2c should produce NO events and NOT leak text
    evs = parser.feed('\x1b[>0;276;0c\x1b[?1;2c');
    expect(evs).toEqual([]);
    expect(parser.pending).toBe(false);
  });

  test('Legacy X10 mouse ESC[M is consumed and does not leak payload bytes', () => {
    const parser = new InputParser();
    // \x1b[M followed by 3 bytes
    const evs = parser.feed('\x1b[M !!');
    expect(evs).toEqual([]);
    expect(parser.pending).toBe(false);
  });

  test('String sequences OSC, DCS, APC are consumed without leaking', () => {
    const parser = new InputParser();

    // OSC 52 clipboard set terminated with BEL
    let evs = parser.feed('\x1b]52;c;dGVzdA==\x07');
    expect(evs).toEqual([]);
    expect(parser.pending).toBe(false);

    // OSC title terminated with ST \x1b\\
    evs = parser.feed('\x1b]0;My Terminal Window\x1b\\');
    expect(evs).toEqual([]);
    expect(parser.pending).toBe(false);
  });

  test('Alt / Meta chords and Alt+Named keys', () => {
    const parser = new InputParser();

    // Alt+x -> input: '', meta: true
    let evs = parser.feed('\x1bx');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('x', { meta: true }) }]);

    // Alt+Enter
    parser.reset();
    evs = parser.feed('\x1b\r');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('return', { meta: true }) }]);

    // Alt+Backspace
    parser.reset();
    evs = parser.feed('\x1b\x7f');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('backspace', { meta: true }) }]);

    // Alt+Esc (\x1b\x1b)
    parser.reset();
    evs = parser.feed('\x1b\x1b');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('escape', { meta: true }) }]);
  });

  test('C0 control codes', () => {
    const parser = new InputParser();

    // NUL / Ctrl+Space
    let evs = parser.feed('\x00');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('space', { ctrl: true }) }]);

    // Ctrl+A through Ctrl+Z
    parser.reset();
    evs = parser.feed('\x04'); // Ctrl+D
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('d', { ctrl: true }) }]);

    parser.reset();
    evs = parser.feed('\x15'); // Ctrl+U
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('u', { ctrl: true }) }]);

    // Return (CR and LF)
    parser.reset();
    evs = parser.feed('\r');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('return') }]);

    parser.reset();
    evs = parser.feed('\n');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('return') }]);

    // Tab
    parser.reset();
    evs = parser.feed('\t');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('tab') }]);

    // Backspace
    parser.reset();
    evs = parser.feed('\x08');
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('backspace') }]);
  });

  test('Unicode code points and Non-BMP emoji (no surrogate halves)', () => {
    const parser = new InputParser();

    const evs = parser.feed('🚀😀');
    expect(evs).toHaveLength(2);
    expect(evs[0]).toEqual({ type: 'key', input: '🚀', key: makeKey('🚀') });
    expect(evs[1]).toEqual({ type: 'key', input: '😀', key: makeKey('😀') });
    // Check no surrogate halves in input
    expect(evs[0]?.input.length).toBe(2); // UTF-16 code units length of surrogate pair is 2, but single code point string
    expect(evs[0]?.input.charCodeAt(0)).toBe(0xd83d);
    expect(evs[0]?.input.charCodeAt(1)).toBe(0xde80);
  });

  test('Bracketed paste whole, split, and sanitized', () => {
    const parser = new InputParser();

    // Complete paste in one chunk
    let evs = parser.feed('\x1b[200~Hello\r\nWorld\x1b[201~');
    expect(evs).toEqual([{ type: 'paste', text: 'Hello\nWorld' }]);

    // Paste split across multiple chunks right in the middle of terminator
    parser.reset();
    expect(parser.feed('\x1b[200~First part')).toEqual([]);
    expect(parser.inPaste).toBe(true);
    expect(parser.feed(' and second\x1b[20')).toEqual([]);
    expect(parser.inPaste).toBe(true);
    evs = parser.feed('1~after paste');
    expect(evs).toEqual([
      { type: 'paste', text: 'First part and second' },
      { type: 'key', input: 'a', key: makeKey('a') },
      { type: 'key', input: 'f', key: makeKey('f') },
      { type: 'key', input: 't', key: makeKey('t') },
      { type: 'key', input: 'e', key: makeKey('e') },
      { type: 'key', input: 'r', key: makeKey('r') },
      { type: 'key', input: ' ', key: makeKey(' ') },
      { type: 'key', input: 'p', key: makeKey('p') },
      { type: 'key', input: 'a', key: makeKey('a') },
      { type: 'key', input: 's', key: makeKey('s') },
      { type: 'key', input: 't', key: makeKey('t') },
      { type: 'key', input: 'e', key: makeKey('e') },
    ]);
  });

  test('Fragmentation equivalence: any byte boundary split yields identical events', () => {
    const parser = new InputParser();
    const testSequences = [
      '\x1b[A',
      '\x1b[1;5A',
      '\x1b[<64;10;5M',
      '\x1b[5~',
      '\x1b[200~Pasted\x1b[201~',
      'Hello 🚀 world',
      '\x1b[I',
      '\x1b[>0;276;0c',
      '\x1bx',
    ];

    for (const seq of testSequences) {
      // Direct whole parse
      parser.reset();
      const whole = [...parser.feed(seq), ...parser.flush()];

      // Split at each possible index
      for (let split = 1; split < seq.length; split++) {
        parser.reset();
        const part1 = seq.slice(0, split);
        const part2 = seq.slice(split);
        const splitEvs = [...parser.feed(part1), ...parser.feed(part2), ...parser.flush()];
        expect(splitEvs).toEqual(whole);
      }
    }
  });

  test('flush() resolves lone ESC and Alt prefixes', () => {
    const parser = new InputParser();

    // Lone ESC
    parser.feed('\x1b');
    expect(parser.pending).toBe(true);
    let evs = parser.flush();
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('escape') }]);
    expect(parser.pending).toBe(false);

    // Incomplete ESC [
    parser.feed('\x1b[');
    expect(parser.pending).toBe(true);
    evs = parser.flush();
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('[', { meta: true }) }]);
    expect(parser.pending).toBe(false);

    // Incomplete ESC O
    parser.feed('\x1bO');
    expect(parser.pending).toBe(true);
    evs = parser.flush();
    expect(evs).toEqual([{ type: 'key', input: '', key: makeKey('O', { meta: true }) }]);
    expect(parser.pending).toBe(false);
  });
});
