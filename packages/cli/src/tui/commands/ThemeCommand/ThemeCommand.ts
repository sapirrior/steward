import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class ThemeCommand extends Command {
  readonly name = 'theme';
  readonly description = 'Switch visual color theme';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.openDialog('theme');
    return { type: 'open-dialog', dialogId: 'theme' };
  }
}
