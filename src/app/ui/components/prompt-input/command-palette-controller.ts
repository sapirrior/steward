import { defaultCommandRegistry } from '../../../commands/registry.js';
import type { SlashCommand } from '../../../commands/types.js';

export class CommandPaletteController {
  private paletteIdx = 0;
  private dismissed = false;

  public isSlashMode(value: string): boolean {
    return value.startsWith('/') && !value.includes(' ');
  }

  public getMatchingCommands(value: string): SlashCommand[] {
    if (!this.isSlashMode(value) || this.dismissed) return [];
    return defaultCommandRegistry
      .getAll()
      .filter((c) => `/${c.name}`.toLowerCase().startsWith(value.toLowerCase()));
  }

  public getSelectedIndex(): number {
    return this.paletteIdx;
  }

  public setSelectedIndex(idx: number): void {
    this.paletteIdx = idx;
  }

  public resetDismissed(): void {
    this.dismissed = false;
  }

  public dismiss(): boolean {
    if (this.dismissed) return false;
    this.dismissed = true;
    return true;
  }

  public isDismissed(): boolean {
    return this.dismissed;
  }

  /**
   * Handles Arrow Up.
   * If there are matching commands:
   * - If already at index 0 (top of suggestions), we don't trap: dismiss palette and return false so Arrow Up navigates prompt history.
   * - Otherwise move up within palette suggestions.
   */
  public onUp(value: string): boolean {
    const matching = this.getMatchingCommands(value);
    if (matching.length === 0) return false;
    if (this.paletteIdx === 0) {
      this.dismiss();
      return false;
    }
    this.paletteIdx = this.paletteIdx - 1;
    return true;
  }

  /**
   * Handles Arrow Down.
   * If at the bottom of matching commands, dismiss and allow normal cursor movement/history navigation.
   */
  public onDown(value: string): boolean {
    const matching = this.getMatchingCommands(value);
    if (matching.length === 0) return false;
    if (this.paletteIdx >= matching.length - 1) {
      this.dismiss();
      return false;
    }
    this.paletteIdx = this.paletteIdx + 1;
    return true;
  }

  public onTab(value: string): { handled: boolean; completedText?: string } {
    const matching = this.getMatchingCommands(value);
    if (matching.length === 0) return { handled: false };
    const chosen = matching[this.paletteIdx] ?? matching[0];
    if (chosen) {
      return { handled: true, completedText: `/${chosen.name} ` };
    }
    return { handled: false };
  }

  public onSubmit(value: string): { handled: boolean; chosenCommand?: string } {
    const matching = this.getMatchingCommands(value);
    if (matching.length === 0) return { handled: false };
    const chosen = matching[this.paletteIdx] ?? matching[0];
    if (chosen) {
      return { handled: true, chosenCommand: `/${chosen.name}` };
    }
    return { handled: false };
  }
}
