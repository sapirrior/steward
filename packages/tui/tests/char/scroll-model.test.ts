import { describe, expect, test } from 'bun:test';
import { ScrollModel } from '../../src/engine/scroll.js';

describe('Phase 3: Pure ScrollModel (Invariants A1-A7)', () => {
  test('A1 (follow): mode=follow always resolves offset 0 regardless of growth', () => {
    const scroll = new ScrollModel();

    // Initial frame: 10 total rows, 6 viewport rows
    let offset = scroll.resolve({ total: 10, rows: 6, pruned: 0, width: 80 });
    expect(offset).toBe(0);
    expect(scroll.snapshot()).toEqual({ offset: 0, max: 4, totalRows: 10 });

    // Growth: 50 total rows
    offset = scroll.resolve({ total: 50, rows: 6, pruned: 0, width: 80 });
    expect(offset).toBe(0);
    expect(scroll.snapshot()).toEqual({ offset: 0, max: 44, totalRows: 50 });
  });

  test('A2 (anchor): committing rows while scrolled up preserves visible anchor', () => {
    const scroll = new ScrollModel();

    // Frame 1: T=11, R=6, M=5 -> scroll to offset 4 (viewing lines 1..6)
    scroll.resolve({ total: 11, rows: 6, pruned: 0, width: 80 });
    scroll.scrollTo(4);

    let offset = scroll.resolve({ total: 11, rows: 6, pruned: 0, width: 80 });
    expect(offset).toBe(4);

    // Commit 2 more rows (T=13, R=6, M=7) -> offset should automatically adjust to 6 so visible content is unchanged
    offset = scroll.resolve({ total: 13, rows: 6, pruned: 0, width: 80 });
    expect(offset).toBe(6);
    expect(scroll.snapshot()).toEqual({ offset: 6, max: 7, totalRows: 13 });
  });

  test('A2 (prune): dropping oldest history rows maintains visible anchor until clamped', () => {
    const scroll = new ScrollModel();

    // Frame 1: T=20, R=5, M=15 -> scroll to offset 10 (top row is index 5)
    scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    scroll.scrollTo(10);
    let offset = scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    expect(offset).toBe(10);

    // Prune 3 oldest rows (pruned=3, T=17, R=5, M=12)
    // Visible top was absolute row 5. Now pruned=3, so top row is index 2 relative to retained rows.
    // Window is [2, 7) -> offset = 17 - 5 - 2 = 10.
    offset = scroll.resolve({ total: 17, rows: 5, pruned: 3, width: 80 });
    expect(offset).toBe(10);
    expect(scroll.snapshot()).toEqual({ offset: 10, max: 12, totalRows: 17 });
  });

  test('A3 (reaching bottom re-follows): scrolling to bottom switches to follow mode', () => {
    const scroll = new ScrollModel();
    scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });

    scroll.scrollBy(5);
    expect(scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 })).toBe(5);

    // Scroll down to 0
    scroll.scrollBy(-10);
    expect(scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 })).toBe(0);

    // Now append 10 lines -> should stay at 0 in follow mode
    expect(scroll.resolve({ total: 30, rows: 5, pruned: 0, width: 80 })).toBe(0);
  });

  test('A4 (width change): keeps clamped offset on terminal reflow', () => {
    const scroll = new ScrollModel();

    // Initial 80 cols: T=20, R=5, offset=10
    scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    scroll.scrollTo(10);
    scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });

    // Reflow to 40 cols: T becomes 35, R=5, M=30
    const offset = scroll.resolve({ total: 35, rows: 5, pruned: 0, width: 40 });
    expect(offset).toBe(10);
    expect(scroll.snapshot()).toEqual({ offset: 10, max: 30, totalRows: 35 });
  });

  test('A5: request before first painted frame is a safe no-op', () => {
    const scroll = new ScrollModel();
    scroll.scrollBy(5);
    scroll.scrollTo(10);

    // First frame resolves cleanly to 0
    const offset = scroll.resolve({ total: 15, rows: 5, pruned: 0, width: 80 });
    expect(offset).toBe(0);
  });

  test('A6 (idempotence): resolve twice with identical input returns identical offset', () => {
    const scroll = new ScrollModel();
    scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    scroll.scrollTo(7);

    const offset1 = scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    const offset2 = scroll.resolve({ total: 20, rows: 5, pruned: 0, width: 80 });
    expect(offset1).toBe(7);
    expect(offset2).toBe(7);
  });

  test('A7: snapshot().offset <= snapshot().max is always guaranteed', () => {
    const scroll = new ScrollModel();
    scroll.resolve({ total: 10, rows: 5, pruned: 0, width: 80 });
    scroll.scrollTo(9999);

    const snap = scroll.snapshot();
    expect(snap.offset).toBeLessThanOrEqual(snap.max);
    expect(snap.offset).toBe(5);
  });

  test('toTop() sentinel always resolves to top even if content grew this tick', () => {
    const scroll = new ScrollModel();
    scroll.resolve({ total: 10, rows: 5, pruned: 0, width: 80 });

    scroll.toTop();
    // Content grew before frame render: T=25
    const offset = scroll.resolve({ total: 25, rows: 5, pruned: 0, width: 80 });
    expect(offset).toBe(20); // 25 - 5
    expect(scroll.snapshot()).toEqual({ offset: 20, max: 20, totalRows: 25 });
  });
});
