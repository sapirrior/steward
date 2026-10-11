import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class ModelCommand extends Command {
  readonly name = 'model';
  readonly description = 'Switch active AI model reference';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.openDialog('model');
    return { type: 'open-dialog', dialogId: 'model' };
  }
}
