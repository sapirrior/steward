import { DocumentTree } from './DocumentTree.js';
import { measureNode } from './layout.js';
import { ScrollModel } from './scroll.js';

export interface DocumentFrame {
  lines: string[];
  cursor: { line: number; column: number } | null;
  totalVisualRows: number;
  maxScrollOffset: number;
  currentScrollOffset: number;
}

export interface DocumentMeasurement {
  histCount: number;
  liveRows: { text: string }[];
  liveCursor: { row: number; column: number } | null;
  totalPhysicalRows: number;
}

export function measureDocument(
  tree: DocumentTree,
  termWidth: number,
  forceAll = false,
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
): DocumentMeasurement {
  const safeWidth = Math.max(1, termWidth);
  const histCount = tree.getHistoryRowCount(safeWidth, forceAll);
  const liveNodes = tree.getLiveNodes();

  const liveRows: { text: string }[] = [];
  let liveCursor: { row: number; column: number } | null = null;

  for (const node of liveNodes) {
    const nodeStartRow = liveRows.length;
    const { rows, cursorWithinNode } = measureNode(node, safeWidth, forceAll, onOverflow);
    for (const r of rows) {
      liveRows.push(r);
    }
    if (cursorWithinNode && liveCursor === null) {
      liveCursor = {
        row: nodeStartRow + cursorWithinNode.row,
        column: cursorWithinNode.column,
      };
    }
  }

  const totalPhysicalRows = histCount + liveRows.length;
  return { histCount, liveRows, liveCursor, totalPhysicalRows };
}

export function sliceViewport(
  tree: DocumentTree,
  measure: DocumentMeasurement,
  termWidth: number,
  termHeight: number,
  scrollOffset: number,
): DocumentFrame {
  const safeWidth = Math.max(1, termWidth);
  const maxRows = Math.max(1, termHeight);
  const { histCount, liveRows, liveCursor, totalPhysicalRows } = measure;

  const maxScrollOffset = Math.max(0, totalPhysicalRows - maxRows);
  const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScrollOffset));

  // Determine viewport physical row window based on scroll offset from the bottom
  const endIndex = Math.max(0, totalPhysicalRows - clampedScroll);
  const startIndex = Math.max(0, endIndex - maxRows);

  const viewportLines: string[] = [];

  // 1. History rows portion within [startIndex, endIndex)
  if (startIndex < histCount) {
    const histStart = startIndex;
    const histEnd = Math.min(endIndex, histCount);
    const histSlice = tree.sliceHistory(histStart, histEnd, safeWidth);
    for (const r of histSlice) {
      viewportLines.push(r.text);
    }
  }

  // 2. Live rows portion within [startIndex, endIndex)
  if (endIndex > histCount) {
    const liveStart = Math.max(0, startIndex - histCount);
    const liveEnd = endIndex - histCount;
    for (let i = liveStart; i < liveEnd && i < liveRows.length; i++) {
      viewportLines.push(liveRows[i]?.text ?? '');
    }
  }

  // Translate physical cursor into viewport-relative screen row
  let adjustedCursor: { line: number; column: number } | null = null;
  if (liveCursor) {
    const absoluteCursorRow = histCount + liveCursor.row;
    const cursorViewportRow = absoluteCursorRow - startIndex;
    if (
      cursorViewportRow >= 0 &&
      cursorViewportRow < viewportLines.length &&
      cursorViewportRow < maxRows
    ) {
      adjustedCursor = {
        line: cursorViewportRow,
        column: liveCursor.column,
      };
    }
  }

  return {
    lines: viewportLines,
    cursor: adjustedCursor,
    totalVisualRows: totalPhysicalRows,
    maxScrollOffset,
    currentScrollOffset: clampedScroll,
  };
}

export function computeDocumentFrame(
  tree: DocumentTree,
  termWidth: number,
  termHeight: number,
  scroll: ScrollModel | number = 0,
  forceAll = false,
  _lineWidthCache?: Map<string, number>,
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
): DocumentFrame {
  const safeWidth = Math.max(1, termWidth);
  const safeHeight = Math.max(1, termHeight);
  const measure = measureDocument(tree, safeWidth, forceAll, onOverflow);

  let offset = 0;
  if (typeof scroll === 'number') {
    offset = scroll;
  } else if (scroll && typeof scroll.resolve === 'function') {
    offset = scroll.resolve({
      total: measure.totalPhysicalRows,
      rows: safeHeight,
      pruned: tree.prunedRowCount,
      width: safeWidth,
    });
  }

  return sliceViewport(tree, measure, safeWidth, safeHeight, offset);
}
