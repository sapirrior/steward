import { describe, expect, test } from 'bun:test';
import { DocumentTree } from '../../src/engine/DocumentTree.js';
import StateRenderer from '../../src/engine/StateRenderer.js';
import Component from '../../src/engine/Component.js';
import { memoryIO } from '../../src/terminal/io.js';
import { verifyOrSaveGolden } from '../helpers/golden.js';

class CursorTestComponent extends Component {
  private showCursorFlag: boolean;
  constructor(showCursor: boolean) {
    super();
    this.showCursorFlag = showCursor;
  }
  renderWithCursor(width?: number) {
    return {
      lines: ['Hello world'],
      cursor: this.showCursorFlag ? { logicalLineIndex: 0, characterOffsetWithinLine: 5 } : null,
    };
  }
}

describe('Characterization: StateRenderer Byte Stream Goldens', () => {
  test('Scenario 1: First paint full repaint', () => {
    const tree = new DocumentTree();
    tree.addText(['First line', 'Second line', 'Third line'], false);
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 5 });

    renderer.render(tree, 0, false, new Map(), io);

    verifyOrSaveGolden('scenario1_first_paint', io.output.join(''));
  });

  test('Scenario 2: One changed row (diff render)', () => {
    const tree = new DocumentTree();
    const textNode = tree.addText(['Row 1', 'Row 2', 'Row 3'], false);
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 5 });

    // First frame
    renderer.render(tree, 0, false, new Map(), io);

    // Mutate and clear previous captured bytes
    io.clearOutput();
    textNode.lines = ['Row 1', 'Row 2 MODIFIED', 'Row 3'];
    tree.invalidateCache();

    renderer.render(tree, 0, false, new Map(), io);

    verifyOrSaveGolden('scenario2_one_changed_row', io.output.join(''));
  });

  test('Scenario 3: Force full repaint', () => {
    const tree = new DocumentTree();
    tree.addText(['A', 'B'], false);
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 4 });

    renderer.render(tree, 0, false, new Map(), io);
    io.clearOutput();

    renderer.render(tree, 0, true, new Map(), io);

    verifyOrSaveGolden('scenario3_forced_full_repaint', io.output.join(''));
  });

  test('Scenario 4: Cursor shown', () => {
    const tree = new DocumentTree();
    const comp = new CursorTestComponent(true);
    tree.mountNode({
      id: 'cursor-comp',
      wrap: false,
      clip: true,
      getLines: (w) => comp._getLines(w),
      getLogicalCursor: () => comp.getLogicalCursor(),
    });
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 4 });

    renderer.render(tree, 0, true, new Map(), io);

    verifyOrSaveGolden('scenario4_cursor_shown', io.output.join(''));
  });

  test('Scenario 5: Cursor hidden', () => {
    const tree = new DocumentTree();
    const comp = new CursorTestComponent(false);
    tree.mountNode({
      id: 'no-cursor-comp',
      wrap: false,
      clip: true,
      getLines: (w) => comp._getLines(w),
      getLogicalCursor: () => comp.getLogicalCursor(),
    });
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 4 });

    renderer.render(tree, 0, true, new Map(), io);

    verifyOrSaveGolden('scenario5_cursor_hidden', io.output.join(''));
  });

  test('Scenario 6: Scrolled viewport at offset > 0 with hidden cursor', () => {
    const tree = new DocumentTree();
    tree.addText(['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5', 'Line 6', 'Line 7'], false);
    const renderer = new StateRenderer();
    const io = memoryIO({ columns: 40, rows: 4 });

    // Render scrolled up by 2 rows
    renderer.render(tree, 2, false, new Map(), io);

    verifyOrSaveGolden('scenario6_scrolled_viewport', io.output.join(''));
  });
});
