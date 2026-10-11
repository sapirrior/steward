import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class SettingsCommand extends Command {
  readonly name = 'settings';
  override readonly alias = 'config';
  readonly description = 'Display and configure persistent settings';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.openDialog('settings');
    return { type: 'open-dialog', dialogId: 'settings' };
  }
}
