import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class EffortCommand extends Command {
  readonly name = 'effort';
  readonly description = 'Set reasoning effort: none, low, medium, high, xhigh';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.openDialog('effort');
    return { type: 'open-dialog', dialogId: 'effort' };
  }
}
