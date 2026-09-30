export class HistoryController {
  private history: string[] = [];
  private draft = '';
  private historyIndex = -1;

  constructor(initialHistory?: string[]) {
    this.history = [...(initialHistory ?? [])];
  }

  public getHistory(): string[] {
    return [...this.history];
  }

  public getIndex(): number {
    return this.historyIndex;
  }

  public add(item: string): void {
    if (!item.trim()) return;
    if (this.history.length === 0 || this.history[this.history.length - 1] !== item) {
      this.history.push(item);
    }
    this.historyIndex = -1;
    this.draft = '';
  }

  public resetIndex(): void {
    this.historyIndex = -1;
    this.draft = '';
  }

  public onUp(currentValue: string): { handled: boolean; nextValue?: string; nextPos?: number } {
    if (this.history.length === 0) return { handled: false };
    if (this.historyIndex === -1) {
      this.draft = currentValue;
    }
    const nextIndex =
      this.historyIndex === -1 ? this.history.length - 1 : Math.max(0, this.historyIndex - 1);
    this.historyIndex = nextIndex;
    const historical = this.history[nextIndex] ?? '';
    return {
      handled: true,
      nextValue: historical,
      nextPos: historical.length,
    };
  }

  public onDown(): { handled: boolean; nextValue?: string; nextPos?: number } {
    if (this.historyIndex === -1) return { handled: false };
    const nextIndex = this.historyIndex + 1;
    if (nextIndex >= this.history.length) {
      const restoredDraft = this.draft;
      this.historyIndex = -1;
      this.draft = '';
      return {
        handled: true,
        nextValue: restoredDraft,
        nextPos: restoredDraft.length,
      };
    } else {
      this.historyIndex = nextIndex;
      const historical = this.history[nextIndex] ?? '';
      return {
        handled: true,
        nextValue: historical,
        nextPos: historical.length,
      };
    }
  }
}
