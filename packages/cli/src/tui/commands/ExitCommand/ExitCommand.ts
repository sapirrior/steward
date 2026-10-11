import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class ExitCommand extends Command {
  readonly name = 'exit';
  override readonly alias = 'quit';
  readonly description = 'Exit Steward session';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.exitApp();
    return { type: 'action-complete', message: 'Exiting Steward...' };
  }
}
