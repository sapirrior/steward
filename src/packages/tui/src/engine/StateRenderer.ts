import type { DocumentTree } from './DocumentTree.js';
import { computeDocumentFrame, type DocumentFrame } from './FrameBuffer.js';
import { ScreenBuffer } from '../layout/ScreenBuffer.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import {
  START_SYNC_OUTPUT,
  END_SYNC_OUTPUT,
  CLEAR_SCREEN,
  CLEAR_LINE,
  SHOW_CURSOR,
  HIDE_CURSOR,
  RESET_SGR,
  cursorTo,
} from '../terminal/sequences.js';

export default class StateRenderer {
  private syncActive = false;
  /** Last painted ScreenBuffer — used for diffing on the next frame. */
  private previousBuffer: ScreenBuffer | null = null;
  private defaultIO?: TerminalIO;

  private beginSync(): string {
    if (this.syncActive) return '';
    this.syncActive = true;
    return START_SYNC_OUTPUT;
  }

  private endSync(): string {
    if (!this.syncActive) return '';
    this.syncActive = false;
    return END_SYNC_OUTPUT;
  }

  render(
    tree: DocumentTree,
    scrollOffset = 0,
    forceFull = false,
    lineWidthCache: Map<string, number> = new Map(),
    io?: { columns: number; rows: number; write: (data: string) => void },
    onOverflow?: (info: { width: number; maxCols: number; row: string }) => void,
  ): DocumentFrame {
    if (!io && !this.defaultIO) {
      this.defaultIO = nodeIO();
    }
    const targetIO = io ?? this.defaultIO!;
    const termWidth = targetIO.columns;
    const termHeight = targetIO.rows;

    const nextFrame = computeDocumentFrame(
      tree,
      termWidth,
      termHeight,
      scrollOffset,
      forceFull,
      lineWidthCache,
      onOverflow,
    );

    const nextLines = nextFrame.lines;
    const currentBuffer = new ScreenBuffer(termWidth, termHeight);
    for (let y = 0; y < nextLines.length && y < termHeight; y++) {
      const line = nextLines[y] ?? '';
      currentBuffer.blitText(0, y, termWidth, line);
    }

    let output = this.beginSync();

    if (forceFull || !this.previousBuffer) {
      // Full repaint: clear screen then write all lines top-to-bottom
      output += CLEAR_SCREEN;
      for (let i = 0; i < termHeight; i++) {
        const line = currentBuffer.getRow(i);
        const resetSuffix = line.includes('\x1b') && !line.endsWith(RESET_SGR) ? RESET_SGR : '';
        output +=
          i === termHeight - 1 ? '\r' + line + resetSuffix : '\r' + line + resetSuffix + '\n';
      }
    } else {
      // ScreenBuffer-based diff: only rewrite rows that changed
      const diffs = currentBuffer.diff(this.previousBuffer);
      for (const { row, text } of diffs) {
        if (text.length > 0) {
          const resetSuffix = text.includes('\x1b') && !text.endsWith(RESET_SGR) ? RESET_SGR : '';
          output += `${cursorTo(row + 1, 1)}${CLEAR_LINE}${text}${resetSuffix}`;
        } else {
          output += `${cursorTo(row + 1, 1)}${CLEAR_LINE}${RESET_SGR}`;
        }
      }
    }

    // Place cursor
    if (nextFrame.cursor) {
      output += `${SHOW_CURSOR}${cursorTo(nextFrame.cursor.line + 1, nextFrame.cursor.column)}`;
    } else {
      output += HIDE_CURSOR;
    }

    output += this.endSync();

    if (output.length > 0) {
      targetIO.write(output);
    }

    this.previousBuffer = currentBuffer;
    return nextFrame;
  }

  /**
   * Resets the previous-frame baseline so the next render does a full repaint.
   * Called when the alternate screen is re-entered or history is flushed.
   */
  clearPreviousFrameRecord(): void {
    this.previousBuffer = null;
  }
}
