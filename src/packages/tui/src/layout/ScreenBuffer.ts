import { SgrState } from '../text/ansi.js';
import { graphemeWidth, segmentGraphemes } from '../text/width.js';
import { sanitize } from '../text/sanitize.js';
import { RESET_SGR } from '../terminal/sequences.js';

export class ScreenBuffer {
  readonly width: number;
  readonly height: number;

  private chars: string[];
  private styleIds: Uint32Array;
  private widths: Uint8Array;
  private rowCache: (string | null)[];

  private styleTable: string[];
  private styleMap: Map<string, number>;

  constructor(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const totalCells = this.width * this.height;
    this.chars = new Array(totalCells);
    this.styleIds = new Uint32Array(totalCells);
    this.widths = new Uint8Array(totalCells);
    this.rowCache = new Array(this.height).fill(null);

    this.styleTable = [''];
    this.styleMap = new Map([['', 0]]);

    this.clear();
  }

  private internStyle(style: string): number {
    if (!style) return 0;
    const existing = this.styleMap.get(style);
    if (existing !== undefined) return existing;

    const id = this.styleTable.length;
    this.styleTable.push(style);
    this.styleMap.set(style, id);
    return id;
  }

  clear(): void {
    const totalCells = this.width * this.height;
    this.chars.fill(' ');
    this.styleIds.fill(0);
    this.widths.fill(1);
    this.rowCache.fill('');
  }

  blitText(x: number, y: number, maxWidth: number, styledText: string): void {
    if (y < 0 || y >= this.height || x >= this.width || maxWidth <= 0 || !styledText) {
      return;
    }

    const availableCols = Math.min(maxWidth, this.width - x);
    if (availableCols <= 0) return;

    // Sanitize input to enforce terminal security invariant
    const safeText = sanitize(styledText);
    this.rowCache[y] = null;

    const rowOffset = y * this.width;
    const ansiRegex = /\x1b\[[0-9;]*m/g;
    const sgrState = new SgrState();

    let col = 0;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    const processPlain = (plain: string) => {
      for (const g of segmentGraphemes(plain)) {
        if (col >= availableCols) return;
        const w = graphemeWidth(g);
        if (w === 0) continue;
        if (col + w > availableCols) return;

        const currentStyleStr = sgrState.toString();
        const styleId = this.internStyle(currentStyleStr);
        const cellIdx = rowOffset + x + col;

        this.chars[cellIdx] = g;
        this.styleIds[cellIdx] = styleId;
        this.widths[cellIdx] = w;

        if (w === 2 && x + col + 1 < this.width) {
          const nextIdx = cellIdx + 1;
          this.chars[nextIdx] = '';
          this.styleIds[nextIdx] = styleId;
          this.widths[nextIdx] = 0;
        }

        col += w;
      }
    };

    while ((match = ansiRegex.exec(safeText)) !== null) {
      if (match.index > lastIndex) {
        processPlain(safeText.slice(lastIndex, match.index));
        if (col >= availableCols) break;
      }
      sgrState.apply(match[0]);
      lastIndex = ansiRegex.lastIndex;
    }

    if (lastIndex < safeText.length && col < availableCols) {
      processPlain(safeText.slice(lastIndex));
    }
  }

  getRow(y: number): string {
    if (y < 0 || y >= this.height) return '';
    const cached = this.rowCache[y];
    if (cached !== null && cached !== undefined) return cached;

    const rowOffset = y * this.width;

    // Find the last non-space cell
    let lastUsedCol = this.width - 1;
    while (lastUsedCol >= 0) {
      const idx = rowOffset + lastUsedCol;
      const char = this.chars[idx];
      const styleId = this.styleIds[idx];
      if (char !== ' ' || styleId !== 0) {
        break;
      }
      lastUsedCol--;
    }

    if (lastUsedCol < 0) {
      this.rowCache[y] = '';
      return '';
    }

    let out = '';
    let currentStyleId = 0;

    for (let x = 0; x <= lastUsedCol; x++) {
      const idx = rowOffset + x;
      const w = this.widths[idx];
      if (w === 0) continue; // Wide character second cell

      const cellStyleId = this.styleIds[idx]!;
      if (cellStyleId !== currentStyleId) {
        if (currentStyleId !== 0 && cellStyleId === 0) {
          out += RESET_SGR;
        } else if (cellStyleId !== 0) {
          const styleStr = this.styleTable[cellStyleId] || '';
          if (currentStyleId !== 0) {
            out += RESET_SGR + styleStr;
          } else {
            out += styleStr;
          }
        }
        currentStyleId = cellStyleId;
      }

      out += this.chars[idx];
    }

    if (currentStyleId !== 0) {
      out += RESET_SGR;
    }

    this.rowCache[y] = out;
    return out;
  }

  diff(prev: ScreenBuffer): Array<{ row: number; text: string }> {
    const changes: Array<{ row: number; text: string }> = [];
    const maxRows = Math.max(this.height, prev.height);

    for (let y = 0; y < maxRows; y++) {
      const currentLine = y < this.height ? this.getRow(y) : '';
      const prevLine = y < prev.height ? prev.getRow(y) : '';

      if (currentLine !== prevLine) {
        changes.push({ row: y, text: currentLine });
      }
    }

    return changes;
  }

  toLines(): string[] {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) {
      lines.push(this.getRow(y));
    }
    return lines;
  }

  toString(): string {
    return this.toLines().join('\n');
  }
}

export default ScreenBuffer;
