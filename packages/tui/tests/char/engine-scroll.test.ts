import { describe, expect, test } from 'bun:test';
import { makeEngine } from '../helpers/term.js';
import Component from '../../src/engine/Component.js';

class LivePrompt extends Component {
  render() {
    return ['> live prompt'];
  }
}

describe('Phase 3: Engine Scroll Integration & Anchoring', () => {
  test('S1: Viewport content remains stable while scrolled up when new lines are committed', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 6 });
    engine.mount(new LivePrompt());

    // Commit 10 lines (lines 0..9)
    for (let i = 0; i < 10; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    // Scroll up by 4 rows
    engine.scrollBy(4);
    await engine.flush();

    // Capture the visible lines while scrolled up
    const stateBefore = engine.getScrollState();
    expect(stateBefore.offset).toBe(4);

    io.clearOutput();
    // Commit 2 more lines while user is reading history
    engine.commit(['line 10 NEW']);
    engine.commit(['line 11 NEW']);
    await engine.flush();

    const stateAfter = engine.getScrollState();
    // Offset should automatically adjust from 4 to 6 to keep visible content pinned
    expect(stateAfter.offset).toBe(6);
    expect(stateAfter.totalRows).toBe(13); // 12 history + 1 live

    engine.dispose();
  });

  test('scrollToTop lands on first row even when content is committed in the same tick', async () => {
    const { engine } = makeEngine({ columns: 40, rows: 5 });
    engine.mount(new LivePrompt());

    for (let i = 0; i < 10; i++) {
      engine.commit([`Initial ${i}`]);
    }
    await engine.flush();

    // Request scroll to top and commit extra lines in the same tick before flush
    engine.scrollToTop();
    engine.commit(['Extra line A']);
    engine.commit(['Extra line B']);
    await engine.flush();

    const state = engine.getScrollState();
    // Total is 12 history + 1 live = 13. Viewport is 5 rows -> max offset is 8.
    expect(state.offset).toBe(8);
    expect(state.max).toBe(8);

    engine.dispose();
  });

  test('getScrollState consistency after scrollTo(9999) before and after frame', async () => {
    const { engine } = makeEngine({ columns: 40, rows: 5 });
    engine.mount(new LivePrompt());

    for (let i = 0; i < 10; i++) {
      engine.commit([`Row ${i}`]);
    }
    await engine.flush();

    engine.scrollTo(9999);
    const snapBefore = engine.getScrollState();
    // Clamped against last known max
    expect(snapBefore.offset).toBeLessThanOrEqual(snapBefore.max);

    await engine.flush();
    const snapAfter = engine.getScrollState();
    expect(snapAfter.offset).toBe(snapAfter.max);

    engine.dispose();
  });

  test('Resize preserves clamped scroll position', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 6 });
    engine.mount(new LivePrompt());

    for (let i = 0; i < 20; i++) {
      engine.commit([`Item ${i}`]);
    }
    await engine.flush();

    engine.scrollTo(8);
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(8);

    // Resize terminal height
    io.resize(40, 10);
    // Wait for resize debounce (50ms)
    await new Promise((r) => setTimeout(r, 80));
    await engine.flush();

    // Height increased from 6 to 10: top row (row 7) is preserved at top of screen -> offset becomes 4 (21 - 10 - 7 = 4)
    expect(engine.getScrollState().offset).toBe(4);

    engine.dispose();
  });
});
