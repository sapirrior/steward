import { describe, expect, test } from 'bun:test';
import { DocumentTree } from '../../src/engine/DocumentTree.js';
import StateRenderer from '../../src/engine/StateRenderer.js';
import Component from '../../src/engine/Component.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function withFakeTTY(
  columns: number,
  rows: number,
  fn: (capture: () => string) => void,
): string {
  const origCols = process.stdout.columns;
  const origRows = process.stdout.rows;
  const origWrite = process.stdout.write;

  let output = '';
  process.stdout.columns = columns;
  process.stdout.rows = rows;
  process.stdout.write = ((chunk: any) => {
    output += String(chunk);
    return true;
  }) as any;

  try {
    fn(() => output);
    return output;
  } finally {
    process.stdout.columns = origCols;
    process.stdout.rows = origRows;
    process.stdout.write = origWrite;
  }
}

function verifyOrSaveGolden(name: string, actual: string) {
  const goldenPath = join(import.meta.dir, '../goldens', `${name}.txt`);
  if (!existsSync(goldenPath)) {
    writeFileSync(goldenPath, actual, 'utf8');
  }
  const expected = readFileSync(goldenPath, 'utf8');
  expect(actual).toBe(expected);
}

describe('Characterization: StateRenderer Byte Stream Goldens', () => {
  test('Scenario 1: First paint full repaint', () => {
    const tree = new DocumentTree();
    tree.addText(['First line', 'Second line', 'Third line'], false);
    const renderer = new StateRenderer();

    let captured = '';
    withFakeTTY(40, 5, () => {
      renderer.render(tree, 0, false);
    });

    withFakeTTY(40, 5, (getOut) => {
      const freshRenderer = new StateRenderer();
      freshRenderer.render(tree, 0, false);
      captured = getOut();
    });

    verifyOrSaveGolden('scenario1_first_paint', captured);
  });

  test('Scenario 2: One changed row (diff render)', () => {
    const tree = new DocumentTree();
    const textNode = tree.addText(['Row 1', 'Row 2', 'Row 3'], false);
    const renderer = new StateRenderer();

    let captured = '';
    withFakeTTY(40, 5, (getOut) => {
      // First frame
      renderer.render(tree, 0, false);
      // Mutate
      textNode.lines = ['Row 1', 'Row 2 MODIFIED', 'Row 3'];
      tree.invalidateCache();
      // Clear captured from frame 1
      const frame2Output = withFakeTTY(40, 5, (getOut2) => {
        renderer.render(tree, 0, false);
        captured = getOut2();
      });
    });

    verifyOrSaveGolden('scenario2_one_changed_row', captured);
  });

  test('Scenario 3: Force full repaint', () => {
    const tree = new DocumentTree();
    tree.addText(['A', 'B'], false);
    const renderer = new StateRenderer();

    let captured = '';
    withFakeTTY(40, 4, () => {
      renderer.render(tree, 0, false);
    });

    withFakeTTY(40, 4, (getOut) => {
      renderer.render(tree, 0, true);
      captured = getOut();
    });

    verifyOrSaveGolden('scenario3_forced_full_repaint', captured);
  });

  test('Scenario 4: Cursor shown', () => {
    const tree = new DocumentTree();
    const comp = new CursorTestComponent(true);
    tree.mountNode({
      id: 'cursor-comp',
      kind: 'custom',
      wrap: false,
      clip: true,
      getLines: (w) => comp._getLines(w),
      getLogicalCursor: () => comp.getLogicalCursor(),
    });
    const renderer = new StateRenderer();

    let captured = '';
    withFakeTTY(40, 4, (getOut) => {
      renderer.render(tree, 0, true);
      captured = getOut();
    });

    verifyOrSaveGolden('scenario4_cursor_shown', captured);
  });

  test('Scenario 5: Cursor hidden', () => {
    const tree = new DocumentTree();
    const comp = new CursorTestComponent(false);
    tree.mountNode({
      id: 'no-cursor-comp',
      kind: 'custom',
      wrap: false,
      clip: true,
      getLines: (w) => comp._getLines(w),
      getLogicalCursor: () => comp.getLogicalCursor(),
    });
    const renderer = new StateRenderer();

    let captured = '';
    withFakeTTY(40, 4, (getOut) => {
      renderer.render(tree, 0, true);
      captured = getOut();
    });

    verifyOrSaveGolden('scenario5_cursor_hidden', captured);
  });
});
