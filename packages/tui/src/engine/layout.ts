import { visibleWidth, visibleColumnAtOffset } from '../text/width.js';
import { truncate } from '../text/truncate.js';
import { wrapVisualLineWithCursor, wrapVisualLine } from '../text/wrap.js';
import type { ComponentNode, DocumentTree } from './DocumentTree.js';

export interface PhysicalRow {
  /** The literal string to draw for this row (may contain ANSI SGR codes). */
  text: string;
  /** Index of the logical line (within the current node) this row was wrapped from. */
  sourceLineIndex: number;
  /** Which wrapped segment of that logical line this is (0 = first segment). */
  wrapSegmentIndex: number;
}

export interface CellCursor {
  /** Absolute physical row (0-indexed, within the full unscrolled document). */
  row: number;
  /** 1-indexed physical column, matching ANSI CUP convention. */
  column: number;
}

export interface CellLayoutResult {
  /** Every physical row of the full document, in order. */
  physicalRows: PhysicalRow[];
  /** Absolute physical cursor position, or null if no node reports one. */
  cursor: CellCursor | null;
  /** Total physical rows count. */
  totalPhysicalRows: number;
}

export function assertRowWidth(
  row: string,
  maxCols: number,
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
): string {
  if (maxCols <= 0) return '';
  const visWidth = visibleWidth(row);
  if (visWidth > maxCols) {
    if (onOverflow) {
      onOverflow({ width: visWidth, maxCols, row });
    }
    return truncate(row, maxCols, { mode: 'end', ellipsis: '' });
  }
  return row;
}

/**
 * Measures a single ComponentNode and breaks its logical lines into PhysicalRows.
 * Respects overflow ('wrap') and truncation ('clip' | 'ellipsis').
 */
export function measureNode(
  node: ComponentNode,
  contentWidth: number,
  forceAll = false,
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
): { rows: PhysicalRow[]; cursorWithinNode: { row: number; column: number } | null } {
  const logicalLines = node.getLines(contentWidth, forceAll);
  const rows: PhysicalRow[] = [];

  const isWrappable = node.wrap;
  const isClipped = node.clip;
  const hasEllipsis = node.ellipsis ?? false;
  const hangingIndent = node.hangingIndent ?? 0;
  const logicalCursor = node.getLogicalCursor ? node.getLogicalCursor() : null;

  let cursorWithinNode: { row: number; column: number } | null = null;

  for (let lIdx = 0; lIdx < logicalLines.length; lIdx++) {
    const rawLine = logicalLines[lIdx] ?? '';
    let line = rawLine;

    if (!isWrappable && isClipped) {
      line = truncate(rawLine, contentWidth, {
        mode: 'end',
        ellipsis: hasEllipsis ? '…' : '',
      });
    }

    const targetCharOffset =
      logicalCursor && logicalCursor.logicalLineIndex === lIdx
        ? logicalCursor.characterOffsetWithinLine
        : null;

    const { segments, cursorInLine } = isWrappable
      ? wrapVisualLineWithCursor(line, contentWidth, targetCharOffset, hangingIndent)
      : {
          segments: [line],
          cursorInLine:
            targetCharOffset !== null
              ? {
                  segmentIndex: 0,
                  column: Math.max(
                    1,
                    Math.min(contentWidth, visibleColumnAtOffset(line, targetCharOffset)),
                  ),
                }
              : null,
        };

    const lineStartRow = rows.length;
    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      rows.push({
        text: assertRowWidth(segments[sIdx] ?? '', contentWidth, onOverflow),
        sourceLineIndex: lIdx,
        wrapSegmentIndex: sIdx,
      });
    }

    if (cursorInLine && cursorWithinNode === null) {
      cursorWithinNode = {
        row: lineStartRow + cursorInLine.segmentIndex,
        column: cursorInLine.column,
      };
    }
  }

  return { rows, cursorWithinNode };
}

/**
 * Lays out the complete DocumentTree into flat physical rows and absolute CellCursor.
 */
export function layoutDocument(
  tree: DocumentTree,
  contentWidth: number,
  forceAll = false,
  _lineWidthCache: Map<string, number> = new Map(),
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
): CellLayoutResult {
  const hasHistoryCache =
    typeof tree.getHistoryRows === 'function' && typeof tree.getLiveNodes === 'function';

  let physicalRows: PhysicalRow[];
  let nodesToMeasure: ComponentNode[];

  if (hasHistoryCache) {
    const historyRows = tree.getHistoryRows(contentWidth, forceAll);
    physicalRows = [...historyRows];
    nodesToMeasure = tree.getLiveNodes();
  } else {
    physicalRows = [];
    nodesToMeasure = typeof tree.getNodes === 'function' ? tree.getNodes() : [];
  }

  let absoluteCursor: CellCursor | null = null;

  for (const node of nodesToMeasure) {
    const nodeStartRow = physicalRows.length;
    const { rows, cursorWithinNode } = measureNode(node, contentWidth, forceAll, onOverflow);

    for (const r of rows) {
      physicalRows.push(r);
    }

    if (cursorWithinNode && absoluteCursor === null) {
      absoluteCursor = {
        row: nodeStartRow + cursorWithinNode.row,
        column: cursorWithinNode.column,
      };
    }
  }

  return {
    physicalRows,
    cursor: absoluteCursor,
    totalPhysicalRows: physicalRows.length,
  };
}

export { wrapVisualLine, wrapVisualLineWithCursor };
