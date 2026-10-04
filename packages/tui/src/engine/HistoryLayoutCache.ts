import type { PhysicalRow } from './layout.js';

export interface CachedEntryLayout {
  entryId: string;
  width: number;
  physicalRows: PhysicalRow[];
  rowCount: number;
}

/**
 * Cache for immutable committed history entry layouts.
 * Keyed by `${entryId}:${width}`.
 */
export class HistoryLayoutCache {
  private cache = new Map<string, CachedEntryLayout>();
  private currentWidth = -1;

  public get size(): number {
    return this.cache.size;
  }

  public getOrCompute(
    entryId: string,
    width: number,
    compute: () => PhysicalRow[],
  ): CachedEntryLayout {
    if (this.currentWidth !== -1 && this.currentWidth !== width) {
      this.cache.clear();
    }
    this.currentWidth = width;

    const key = `${entryId}:${width}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }
    const physicalRows = compute();
    const result: CachedEntryLayout = {
      entryId,
      width,
      physicalRows,
      rowCount: physicalRows.length,
    };
    this.cache.set(key, result);
    return result;
  }

  public deleteNode(entryId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${entryId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  public invalidateWidth(width: number): void {
    if (this.currentWidth === width) {
      this.cache.clear();
      this.currentWidth = -1;
    }
  }

  public clear(): void {
    this.cache.clear();
    this.currentWidth = -1;
  }
}

export default HistoryLayoutCache;
