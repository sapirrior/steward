import type { Theme } from '../../themes/themeTypes.js';
import type { StewardSettings } from '../../settings/settingsTypes.js';
import type { ThreadController } from '../../threads/ThreadController.js';

export type CommandOutcome =
  | { type: 'open-dialog'; dialogId: string }
  | { type: 'action-complete'; message?: string }
  | { type: 'error'; message: string };

export interface CommandContext {
  threadController: ThreadController;
  settings: StewardSettings;
  theme: Theme;
  openDialog: (dialogId: string) => void;
  closeDialog: () => void;
  exitApp: () => void;
  notify?: (message: string) => void;
}

export abstract class Command {
  /** Canonical name of the command, e.g. 'new', 'settings', 'model' */
  abstract readonly name: string;

  /** Single primary alias, e.g. 'clear' for new, 'config' for settings, 'q' for exit */
  readonly alias?: string;

  /** Brief description shown in the command palette */
  abstract readonly description: string;

  /**
   * Executes the command. May open a dialog or perform a direct action.
   */
  abstract execute(args: string, context: CommandContext): Promise<CommandOutcome> | CommandOutcome;

  /**
   * Display format for the command palette, e.g. "/new (clear)" or "/settings (config)"
   */
  get displayLabel(): string {
    return this.alias ? `/${this.name} (${this.alias})` : `/${this.name}`;
  }
}
