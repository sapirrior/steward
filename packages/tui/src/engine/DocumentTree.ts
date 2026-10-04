import { measureNode, type PhysicalRow } from './layout.js';
import { HistoryLayoutCache } from './HistoryLayoutCache.js';

export interface ComponentNode {
  id: string;
  wrap: boolean;
  clip: boolean;
  ellipsis?: boolean;
  hangingIndent?: number;
  getLines(width: number, forceAll?: boolean): string[];
  /**
   * Optional: logical cursor location { logicalLineIndex, characterOffsetWithinLine }.
   * logicalLineIndex: 0-indexed index into the lines returned by getLines(width).
   * characterOffsetWithinLine: character offset within that rendered logical line.
   */
  getLogicalCursor?(): { logicalLineIndex: number; characterOffsetWithinLine: number } | null;
  onMount?(): void;
  onUnmount?(): void;
  onResize?(width: number, height: number): void;
}

export class TextNode implements ComponentNode {
  id: string;
  lines: string[];
  wrap: boolean;
  clip: boolean;
  ellipsis?: boolean;
  hangingIndent?: number;
  maxReadableWidth?: number;

  constructor(
    id: string,
    lines: string[],
    wrap = true,
    maxReadableWidth?: number,
    hangingIndent?: number,
    clip = false,
    ellipsis = false,
  ) {
    this.id = id;
    this.lines = lines;
    this.wrap = wrap;
    this.clip = clip;
    this.ellipsis = ellipsis;
    this.maxReadableWidth = maxReadableWidth;
    this.hangingIndent = hangingIndent;
  }

  invalidateCache(): void {
    // No-op: wrapping is owned by measureNode
  }

  getLines(_width?: number, _forceAll = false): string[] {
    return this.lines;
  }
}

export class ResponsiveHistoryNode implements ComponentNode {
  id: string;
  renderFn: (width: number) => string[];
  wrap: boolean;
  clip: boolean;
  ellipsis?: boolean;
  hangingIndent?: number;
  private _cachedWidth = -1;
  private _cachedLines: string[] = [];

  constructor(
    id: string,
    renderFn: (width: number) => string[],
    wrap = false,
    clip = true,
    hangingIndent?: number,
  ) {
    this.id = id;
    this.renderFn = renderFn;
    this.wrap = wrap;
    this.clip = clip;
    this.hangingIndent = hangingIndent;
  }

  invalidateCache(): void {
    this._cachedWidth = -1;
    this._cachedLines = [];
  }

  getLines(width: number, forceAll = false): string[] {
    if (!forceAll && width === this._cachedWidth && this._cachedLines.length > 0) {
      return this._cachedLines;
    }
    this._cachedWidth = width;
    this._cachedLines = this.renderFn(width);
    return this._cachedLines;
  }
}

export class DocumentTree {
  historyLimit?: number;
  private historyNodes: (TextNode | ResponsiveHistoryNode | ComponentNode)[] = [];
  private liveNodes: ComponentNode[] = [];
  private idCounter = 0;
  private cachedHistoryRows: PhysicalRow[] = [];
  private lastHistoryWidth = -1;
  private layoutCache = new HistoryLayoutCache();

  private _prunedRowCount = 0;

  constructor(options?: { historyLimit?: number }) {
    this.historyLimit = options?.historyLimit;
  }

  get historyRowCount(): number {
    return this.cachedHistoryRows.length;
  }

  get prunedRowCount(): number {
    return this._prunedRowCount;
  }

  private pruneHistoryIfNeeded(): void {
    if (
      this.historyLimit &&
      this.historyLimit > 0 &&
      this.cachedHistoryRows.length > this.historyLimit
    ) {
      const dropCount = this.cachedHistoryRows.length - this.historyLimit;
      this._prunedRowCount += dropCount;
      this.cachedHistoryRows = this.cachedHistoryRows.slice(dropCount);
      // If historyNodes array grows excessively, keep it bounded
      if (this.historyNodes.length > this.historyLimit * 2) {
        this.historyNodes = this.historyNodes.slice(this.historyNodes.length - this.historyLimit);
      }
    }
  }

  addText(
    lines: string[],
    wrap = true,
    maxReadableWidth?: number,
    hangingIndent?: number,
    clip = false,
    ellipsis = false,
  ): TextNode {
    const node = new TextNode(
      `node-${this.idCounter++}`,
      lines,
      wrap,
      maxReadableWidth,
      hangingIndent,
      clip,
      ellipsis,
    );
    this.historyNodes.push(node);
    if (this.lastHistoryWidth > 0) {
      const cached = this.layoutCache.getOrCompute(node.id, this.lastHistoryWidth, () => {
        const { rows } = measureNode(node, this.lastHistoryWidth);
        return rows;
      });
      for (const r of cached.physicalRows) {
        this.cachedHistoryRows.push(r);
      }
      this.pruneHistoryIfNeeded();
    }
    return node;
  }

  addResponsive(
    renderFn: (width: number) => string[],
    wrap = false,
    clip = true,
    hangingIndent?: number,
  ): ResponsiveHistoryNode {
    const node = new ResponsiveHistoryNode(
      `resp-node-${this.idCounter++}`,
      renderFn,
      wrap,
      clip,
      hangingIndent,
    );
    this.historyNodes.push(node);
    if (this.lastHistoryWidth > 0) {
      const cached = this.layoutCache.getOrCompute(node.id, this.lastHistoryWidth, () => {
        const { rows } = measureNode(node, this.lastHistoryWidth);
        return rows;
      });
      for (const r of cached.physicalRows) {
        this.cachedHistoryRows.push(r);
      }
      this.pruneHistoryIfNeeded();
    }
    return node;
  }

  mountNode(node: ComponentNode): void {
    if (!this.liveNodes.includes(node)) {
      this.liveNodes.push(node);
      if (typeof node.onMount === 'function') {
        node.onMount();
      }
    }
  }

  unmountNode(node: ComponentNode): void {
    if (typeof node.onUnmount === 'function') {
      node.onUnmount();
    }
    this.liveNodes = this.liveNodes.filter((n) => n !== node);
  }

  getLiveNodes(): ComponentNode[] {
    return this.liveNodes;
  }

  getHistoryNodes(): ComponentNode[] {
    return this.historyNodes;
  }

  getNodes(): ComponentNode[] {
    return [...this.historyNodes, ...this.liveNodes];
  }

  ensureHistory(contentWidth: number, forceAll = false): void {
    if (!forceAll && contentWidth === this.lastHistoryWidth && this.cachedHistoryRows.length > 0) {
      return;
    }

    this.lastHistoryWidth = contentWidth;
    this.cachedHistoryRows = [];
    for (const node of this.historyNodes) {
      const cached = this.layoutCache.getOrCompute(node.id, contentWidth, () => {
        const { rows } = measureNode(node, contentWidth, forceAll);
        return rows;
      });
      for (const r of cached.physicalRows) {
        this.cachedHistoryRows.push(r);
      }
    }
    this.pruneHistoryIfNeeded();
  }

  getHistoryRowCount(contentWidth: number, forceAll = false): number {
    this.ensureHistory(contentWidth, forceAll);
    return this.cachedHistoryRows.length;
  }

  sliceHistory(start: number, end: number, contentWidth?: number): PhysicalRow[] {
    if (contentWidth !== undefined && contentWidth > 0) {
      this.ensureHistory(contentWidth);
    }
    return this.cachedHistoryRows.slice(start, end);
  }

  getHistoryRows(contentWidth: number, forceAll = false): PhysicalRow[] {
    this.ensureHistory(contentWidth, forceAll);
    return this.cachedHistoryRows;
  }

  invalidateCache(): void {
    if (this.lastHistoryWidth > 0) {
      this.layoutCache.invalidateWidth(this.lastHistoryWidth);
    }
    this.lastHistoryWidth = -1;
    this.cachedHistoryRows = [];
    for (const node of this.historyNodes) {
      if ('invalidateCache' in node && typeof (node as any).invalidateCache === 'function') {
        (node as any).invalidateCache();
      }
    }
  }

  clearHistory(): void {
    this.layoutCache.clear();
    this.historyNodes = [];
    this.cachedHistoryRows = [];
    this.lastHistoryWidth = -1;
  }

  clearAll(): void {
    this.layoutCache.clear();
    for (const node of this.liveNodes) {
      if (typeof node.onUnmount === 'function') {
        node.onUnmount();
      }
    }
    this.historyNodes = [];
    this.liveNodes = [];
    this.cachedHistoryRows = [];
    this.lastHistoryWidth = -1;
  }
}

export default DocumentTree;
