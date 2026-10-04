import { describe, expect, test } from 'bun:test';
import { DocumentTree } from '../../src/engine/DocumentTree.js';
import { HistoryStore } from '../../src/engine/HistoryStore.js';

describe('Phase 6: History and LayoutCache Memory Bounding', () => {
  test('HistoryLayoutCache and DocumentTree stay bounded after 500 commits with historyLimit: 10', () => {
    const tree = new DocumentTree({ historyLimit: 10 });
    tree.getHistoryRowCount(40);

    for (let i = 0; i < 500; i++) {
      tree.addText([`Line ${i}`]);
    }

    const rows = tree.getHistoryRows(40);
    expect(rows.length).toBe(10);
    expect(rows[0]?.text).toBe('Line 490');
    expect(rows[rows.length - 1]?.text).toBe('Line 499');

    // Verification that layout cache size is strictly bounded
    const cacheSize = (tree as any).layoutCache.size;
    expect(cacheSize).toBeLessThanOrEqual(15);
  });

  test('Resize width change clears stale-width cache entries', () => {
    const tree = new DocumentTree({ historyLimit: 10 });
    for (let i = 0; i < 10; i++) {
      tree.addText([`Item ${i}`]);
    }

    // Width 40
    tree.getHistoryRowCount(40);
    expect((tree as any).layoutCache.size).toBe(10);

    // Resize chain: 55 -> 70
    tree.getHistoryRowCount(55);
    expect((tree as any).layoutCache.size).toBe(10);

    tree.getHistoryRowCount(70);
    expect((tree as any).layoutCache.size).toBe(10);
  });

  test('HistoryStore memory stays strictly bounded with historyLimit', () => {
    const store = new HistoryStore({ historyLimit: 10 });

    for (let i = 0; i < 100; i++) {
      store.push([`Log entry ${i}`]);
    }

    const allLines = store.getAllLines();
    expect(allLines.length).toBeLessThanOrEqual(10);
    expect(allLines[allLines.length - 1]).toBe('Log entry 99');
  });
});
