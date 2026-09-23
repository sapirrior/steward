import { searchWorkspaceFiles } from '../../utils/file-search.js';

export interface AtData {
  query: string;
  atIndex: number;
}

export class AutocompleteController {
  private matches: string[] = [];
  private selectedIdx = 0;
  private cwd: string;

  constructor(cwd?: string) {
    this.cwd = cwd || process.cwd();
  }

  public setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  public isActive(): boolean {
    return this.matches.length > 0;
  }

  public getMatches(): string[] {
    return this.matches;
  }

  public getSelectedIndex(): number {
    return this.selectedIdx;
  }

  public clear(): void {
    this.matches = [];
    this.selectedIdx = 0;
  }

  public onUp(): boolean {
    if (!this.isActive()) return false;
    this.selectedIdx = this.selectedIdx > 0 ? this.selectedIdx - 1 : this.matches.length - 1;
    return true;
  }

  public onDown(): boolean {
    if (!this.isActive()) return false;
    this.selectedIdx = this.selectedIdx < this.matches.length - 1 ? this.selectedIdx + 1 : 0;
    return true;
  }

  public onTab(
    value: string,
    cursorPos: number,
  ): { handled: boolean; nextValue?: string; nextPos?: number } {
    if (!this.isActive()) return { handled: false };
    const atData = this.getAtData(value, cursorPos);
    if (atData) {
      const chosen = this.matches[this.selectedIdx];
      if (chosen) {
        const before = value.slice(0, atData.atIndex);
        const after = value.slice(cursorPos);
        const nextValue = `${before}@${chosen} ${after}`;
        const nextPos = atData.atIndex + 1 + chosen.length + 1;
        this.clear();
        return { handled: true, nextValue, nextPos };
      }
    }
    return { handled: false };
  }

  public onSubmit(
    value: string,
    cursorPos: number,
  ): { handled: boolean; nextValue?: string; nextPos?: number } {
    return this.onTab(value, cursorPos);
  }

  public onEscape(): boolean {
    if (this.isActive()) {
      this.clear();
      return true;
    }
    return false;
  }

  public getAtData(value: string, cursorPos: number): AtData | null {
    const prefix = value.slice(0, cursorPos);
    const lastAt = prefix.lastIndexOf('@');
    if (
      lastAt !== -1 &&
      (lastAt === 0 || prefix[lastAt - 1] === ' ' || prefix[lastAt - 1] === '\t')
    ) {
      const query = prefix.slice(lastAt + 1);
      if (!query.includes(' ') && !query.includes('\t') && !query.includes('\n')) {
        return { query, atIndex: lastAt };
      }
    }
    return null;
  }

  public async updateQuery(
    value: string,
    cursorPos: number,
    onMatchesChanged?: () => void,
  ): Promise<void> {
    const atData = this.getAtData(value, cursorPos);
    if (atData) {
      const found = await searchWorkspaceFiles(this.cwd, atData.query);
      this.matches = found;
      this.selectedIdx = 0;
      onMatchesChanged?.();
    } else {
      if (this.matches.length > 0) {
        this.clear();
        onMatchesChanged?.();
      }
    }
  }
}
