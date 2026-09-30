import { describe, expect, test } from 'bun:test';
import { DocumentTree } from '../../src/engine/DocumentTree.js';

describe('Step 1.3: History Layout Cache per-tree isolation', () => {
  test('Two DocumentTrees with identical width and same node IDs do not share cache', () => {
    const tree1 = new DocumentTree();
    const tree2 = new DocumentTree();

    // Both start at id 'node-0' internally
    tree1.addText(['Alpha from Tree 1'], false);
    tree2.addText(['Beta from Tree 2 (Different text)'], false);

    const rows1 = tree1.getHistoryRows(80);
    const rows2 = tree2.getHistoryRows(80);

    expect(rows1.map((r) => r.text)).toEqual(['Alpha from Tree 1']);
    expect(rows2.map((r) => r.text)).toEqual(['Beta from Tree 2 (Different text)']);

    // Call again to verify cached result returns correct content per tree
    const rows1Cached = tree1.getHistoryRows(80);
    const rows2Cached = tree2.getHistoryRows(80);

    expect(rows1Cached.map((r) => r.text)).toEqual(['Alpha from Tree 1']);
    expect(rows2Cached.map((r) => r.text)).toEqual(['Beta from Tree 2 (Different text)']);
  });
});
