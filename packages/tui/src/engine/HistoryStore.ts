export interface HistoryEntry {
  id: string;
  tag?: string;
  lines: string[];
  createdAt: number;
}

export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private idCounter = 0;
  private totalLineCount = 0;
  readonly historyLimit?: number;

  constructor(options?: { historyLimit?: number }) {
    this.historyLimit = options?.historyLimit;
  }

  /**
   * Commit a new block of static content.
   */
  push(lines: string[], tag?: string): HistoryEntry {
    const entry: HistoryEntry = {
      id: `entry-${this.idCounter++}`,
      tag,
      lines,
      createdAt: Date.now(),
    };
    this.entries.push(entry);
    this.totalLineCount += lines.length;

    if (this.historyLimit && this.historyLimit > 0) {
      while (this.totalLineCount > this.historyLimit && this.entries.length > 1) {
        const removed = this.entries.shift();
        if (removed) {
          this.totalLineCount -= removed.lines.length;
        }
      }
    }

    return entry;
  }

  /**
   * Returns a copy of all entries.
   */
  getEntries(): HistoryEntry[] {
    return [...this.entries];
  }

  /**
   * Full reconstruction of all lines.
   */
  getAllLines(): string[] {
    return this.entries.flatMap((e) => e.lines);
  }

  /**
   * Returns lines for primary screen flush on exit if needed.
   */
  getPrimaryScreenLines(filter?: (e: HistoryEntry) => boolean): string[] {
    const entries = filter ? this.entries.filter(filter) : this.entries;
    return entries.flatMap((e) => e.lines);
  }

  clearAll(): void {
    this.entries = [];
    this.totalLineCount = 0;
  }
}

export default HistoryStore;
