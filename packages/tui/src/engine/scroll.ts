export interface ScrollSnapshot {
  offset: number;
  max: number;
  totalRows: number;
}

export interface ResolveParams {
  total: number;
  rows: number;
  pruned: number;
  width: number;
}

export class ScrollModel {
  private mode: 'follow' | 'anchored' = 'follow';
  private topId = 0;
  private isSentinelTop = false;
  private lastSnapshot = {
    offset: 0,
    max: 0,
    totalRows: 0,
    width: 0,
    rows: 0,
    pruned: 0,
    hasFrame: false,
  };

  /**
   * Scroll by delta rows.
   * Positive delta scrolls toward history (up), negative scrolls toward live bottom (down).
   */
  scrollBy(delta: number): void {
    if (!this.lastSnapshot.hasFrame) return;

    this.isSentinelTop = false;
    const targetOffset = this.lastSnapshot.offset + delta;

    if (targetOffset <= 0) {
      this.mode = 'follow';
      this.lastSnapshot.offset = 0;
    } else {
      this.mode = 'anchored';
      const clamped = Math.min(targetOffset, this.lastSnapshot.max);
      this.lastSnapshot.offset = clamped;
      this.topId =
        this.lastSnapshot.pruned +
        Math.max(0, this.lastSnapshot.totalRows - clamped - this.lastSnapshot.rows);
    }
  }

  /**
   * Scroll to a specific offset from the bottom.
   */
  scrollTo(offset: number): void {
    if (!this.lastSnapshot.hasFrame) return;

    this.isSentinelTop = false;
    if (offset <= 0) {
      this.mode = 'follow';
      this.lastSnapshot.offset = 0;
    } else {
      this.mode = 'anchored';
      const clamped = Math.min(offset, this.lastSnapshot.max);
      this.lastSnapshot.offset = clamped;
      this.topId =
        this.lastSnapshot.pruned +
        Math.max(0, this.lastSnapshot.totalRows - clamped - this.lastSnapshot.rows);
    }
  }

  /**
   * Scroll all the way to the top of history.
   */
  toTop(): void {
    this.mode = 'anchored';
    this.isSentinelTop = true;
  }

  /**
   * Scroll to the live bottom (following mode).
   */
  toBottom(): void {
    this.mode = 'follow';
    this.isSentinelTop = false;
    this.lastSnapshot.offset = 0;
  }

  /**
   * Resolves the current clamped scroll offset for slicing the viewport.
   */
  resolve(f: ResolveParams): number {
    const safeRows = Math.max(1, f.rows);
    const M = Math.max(0, f.total - safeRows);

    let offset = 0;

    if (this.isSentinelTop) {
      this.isSentinelTop = false;
      this.mode = 'anchored';
      this.topId = f.pruned;
      offset = M;
    } else if (this.mode === 'follow') {
      offset = 0;
    } else {
      // Anchored mode
      if (
        this.lastSnapshot.hasFrame &&
        this.lastSnapshot.width > 0 &&
        f.width !== this.lastSnapshot.width
      ) {
        // Width changed: anchoring by ID is invalid after reflow -> keep previous offset clamped
        offset = Math.max(0, Math.min(this.lastSnapshot.offset, M));
        if (offset === 0) {
          this.mode = 'follow';
        } else {
          this.topId = f.pruned + Math.max(0, f.total - offset - safeRows);
        }
      } else {
        // Unchanged width: anchor by absolute top row ID
        offset = Math.max(0, Math.min(M, f.total - safeRows - (this.topId - f.pruned)));
        if (offset === 0) {
          this.mode = 'follow';
        } else if (offset === M) {
          this.topId = f.pruned;
        }
      }
    }

    this.lastSnapshot = {
      offset,
      max: M,
      totalRows: f.total,
      width: f.width,
      rows: safeRows,
      pruned: f.pruned,
      hasFrame: true,
    };

    return offset;
  }

  /**
   * Returns consistent last-frame scroll state.
   */
  snapshot(): ScrollSnapshot {
    return {
      offset: this.lastSnapshot.offset,
      max: this.lastSnapshot.max,
      totalRows: this.lastSnapshot.totalRows,
    };
  }
}

export default ScrollModel;
