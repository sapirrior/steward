import { describe, expect, test } from 'bun:test';
import { DocumentTree } from '../../src/engine/DocumentTree.js';
import { computeDocumentFrame } from '../../src/engine/FrameBuffer.js';

describe('Characterization: FrameBuffer computeDocumentFrame', () => {
  test('scroll offset clamping and viewport selection', () => {
    const tree = new DocumentTree();
    tree.addText(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6'], false);

    // Height = 3, Total rows = 6. Max scroll = 3.
    // Unscrolled (scrollOffset = 0): shows last 3 lines (4, 5, 6)
    const frame0 = computeDocumentFrame(tree, 80, 3, 0);
    expect(frame0.lines).toEqual(['Line 4', 'Line 5', 'Line 6']);
    expect(frame0.maxScrollOffset).toBe(3);
    expect(frame0.currentScrollOffset).toBe(0);

    // Scrolled by 2: shows lines 2, 3, 4
    const frame2 = computeDocumentFrame(tree, 80, 3, 2);
    expect(frame2.lines).toEqual(['Line 2', 'Line 3', 'Line 4']);
    expect(frame2.currentScrollOffset).toBe(2);

    // Over-scrolled by 100: clamped to maxScrollOffset (3) -> lines 1, 2, 3
    const frameOver = computeDocumentFrame(tree, 80, 3, 100);
    expect(frameOver.lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    expect(frameOver.currentScrollOffset).toBe(3);
  });
});
