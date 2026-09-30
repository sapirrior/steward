export interface HistoryEntry {
  id: string;
  tag?: string;
  lines: string[];
  createdAt: number;
}

export class HistoryStore {
  private entries: HistoryEntry[] = [];
  private idCounter = 0;

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
  }
}

export default HistoryStore;
