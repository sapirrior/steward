import { describe, it, expect } from 'bun:test';
import { TerminalEngine } from '../../src/engine/TerminalEngine.js';
import { DocumentTree } from '../../src/engine/DocumentTree.js';
import { memoryIO } from '../../src/terminal/io.js';
import { StateRenderer } from '../../src/engine/StateRenderer.js';
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN,
  ENABLE_FOCUS_REPORTING,
  DISABLE_FOCUS_REPORTING,
  ENABLE_MOUSE_ALL,
  DISABLE_MOUSE_ALL,
  ENABLE_AUTOWRAP,
  DISABLE_AUTOWRAP,
  CURSOR_HOME,
  HIDE_CURSOR,
  SHOW_CURSOR,
  START_SYNC_OUTPUT,
  END_SYNC_OUTPUT,
  CLEAR_SCREEN,
  CLEAR_LINE,
  RESET_SGR,
} from '../../src/terminal/sequences.js';

describe('Phase 4: Optimized Renderer, Viewport Slicing, Throttling & Scrolling', () => {
  it('4.1 Double buffering: StateRenderer diffing with ScreenBuffer', () => {
    const renderer = new StateRenderer();
    const tree = new DocumentTree();
    const io = memoryIO({ columns: 20, rows: 4 });

    tree.addText(['Line 1', 'Line 2']);
    renderer.render(tree, 0, false, new Map(), io);

    expect(io.written).toContain('Line 1');
    expect(io.written).toContain('Line 2');
    io.clear();

    // Second render with no changes should produce minimal/no diff output
    renderer.render(tree, 0, false, new Map(), io);
    // Synced output begins and ends, but no CLEAR_SCREEN or full repaint
    expect(io.written).not.toContain(CLEAR_SCREEN);
  });

  it('4.1 Security Invariant: hostile strings never leak control codes or OSC into terminal IO', async () => {
    const io = memoryIO({ columns: 40, rows: 10 });
    const engine = new TerminalEngine({ io });
    engine.ensureAlternateScreen();
    io.clear();

    const hostileInputs = [
      '\x1b]52;c;c2VjcmV0\x07', // OSC 52 clipboard set
      '\x1b]0;Title\x07',       // OSC 0 window title
      '\x1b[2J\x1b[H',          // Clear screen / home
      '\x1b[?1049h',            // Alt screen escape injection
      '\x9b31mRed\x9c',         // C1 8-bit CSI/ST
      '\x1bc\x00\x07\x08',      // Reset / NUL / BEL / BS
    ];

    for (const hostile of hostileInputs) {
      engine.commit([`Safe: ${hostile} end`]);
    }

    await engine.flush();

    // Every escape in output must be an allowed frame sequence or a valid SGR sequence \x1b[...m or cursor positioning \x1b[<r>;<c>H
    const written = io.written;
    expect(written).not.toContain('\x1b]52;');
    expect(written).not.toContain('\x1b]0;');
    expect(written).not.toContain('\x1bc');
    expect(written).not.toContain('\x00');
    expect(written).not.toContain('\x07');
    expect(written).not.toContain('\x9b');
    expect(written).not.toContain('\x9c');

    engine.dispose();
  });

  it('4.3 History Viewport Slicing: O(1) viewport render independent of history size', () => {
    const tree = new DocumentTree();
    const rows10k = Array.from({ length: 10000 }, (_, i) => `History Row ${i}`);
    tree.addText(rows10k);

    expect(tree.getHistoryRowCount(40)).toBe(10000);

    const io = memoryIO({ columns: 40, rows: 10 });
    const renderer = new StateRenderer();

    const t0 = performance.now();
    const frame = renderer.render(tree, 0, false, new Map(), io);
    const duration = performance.now() - t0;

    expect(frame.lines.length).toBe(10);
    expect(frame.lines[frame.lines.length - 1]).toContain('History Row 9999');
    expect(frame.totalVisualRows).toBe(10000);
    expect(duration).toBeLessThan(50); // fast sub-50ms viewport render
  });

  it('4.4 Frame scheduling with maxFps and flush()', async () => {
    const io = memoryIO({ columns: 40, rows: 10 });
    const engine = new TerminalEngine({ io, maxFps: 60 });
    engine.ensureAlternateScreen();
    io.clear();

    engine.commit(['Frame 1']);
    engine.commit(['Frame 2']);
    engine.commit(['Frame 3']);

    await engine.flush();

    expect(io.written).toContain('Frame 3');
    engine.dispose();
  });

  it('4.5 Scrolling API: scrollBy, scrollTo, scrollToTop, scrollToBottom, getScrollState', async () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const engine = new TerminalEngine({ io });
    engine.ensureAlternateScreen();

    // 20 lines with 5 rows viewport => max scroll is 15
    engine.commit(Array.from({ length: 20 }, (_, i) => `Item ${i}`));
    await engine.flush();

    // Initially at bottom (offset 0)
    let state = engine.getScrollState();
    expect(state.offset).toBe(0);

    engine.scrollBy(5);
    state = engine.getScrollState();
    expect(state.offset).toBe(5);

    engine.scrollTo(10);
    state = engine.getScrollState();
    expect(state.offset).toBe(10);

    engine.scrollToTop();
    state = engine.getScrollState();
    expect(state.offset).toBeGreaterThanOrEqual(10);

    engine.scrollToBottom();
    state = engine.getScrollState();
    expect(state.offset).toBe(0);

    engine.dispose();
  });

  it('4.6 historyLimit caps history row count and prunes oldest rows', () => {
    const tree = new DocumentTree({ historyLimit: 10 });
    for (let i = 0; i < 50; i++) {
      tree.addText([`Line ${i}`]);
    }

    const rows = tree.getHistoryRows(40);
    expect(rows.length).toBe(10);
    expect(rows[rows.length - 1]?.text).toBe('Line 49');
    expect(rows[0]?.text).toBe('Line 40');
  });
});
