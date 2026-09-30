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
  private frontBuffer: ScreenBuffer | null = null;
  private backBuffer: ScreenBuffer | null = null;
  private lastWidth = 0;
  private lastHeight = 0;
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

  private ensureBuffers(width: number, height: number): { front: ScreenBuffer | null; back: ScreenBuffer } {
    if (width !== this.lastWidth || height !== this.lastHeight || !this.backBuffer) {
      this.frontBuffer = null;
      this.backBuffer = new ScreenBuffer(width, height);
      this.lastWidth = width;
      this.lastHeight = height;
    } else {
      this.backBuffer.clear();
    }
    return { front: this.frontBuffer, back: this.backBuffer };
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

    const { front, back } = this.ensureBuffers(termWidth, termHeight);
    const nextLines = nextFrame.lines;

    for (let y = 0; y < nextLines.length && y < termHeight; y++) {
      const line = nextLines[y] ?? '';
      back.blitText(0, y, termWidth, line);
    }

    let output = this.beginSync();

    if (forceFull || !front) {
      // Full repaint
      output += CLEAR_SCREEN;
      for (let i = 0; i < termHeight; i++) {
        const line = back.getRow(i);
        const resetSuffix = line.includes('\x1b') && !line.endsWith(RESET_SGR) ? RESET_SGR : '';
        output +=
          i === termHeight - 1 ? '\r' + line + resetSuffix : '\r' + line + resetSuffix + '\n';
      }
    } else {
      // Delta diff
      const diffs = back.diff(front);
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

    // Swap buffers: back becomes front, front will become back on next frame
    if (!this.frontBuffer) {
      this.frontBuffer = back;
      this.backBuffer = new ScreenBuffer(termWidth, termHeight);
    } else {
      const temp = this.frontBuffer;
      this.frontBuffer = back;
      this.backBuffer = temp;
    }

    return nextFrame;
  }

  /**
   * Resets the previous-frame baseline so the next render does a full repaint.
   * Called when the alternate screen is re-entered or history is flushed.
   */
  clearPreviousFrameRecord(): void {
    this.frontBuffer = null;
  }
}

export { StateRenderer };
