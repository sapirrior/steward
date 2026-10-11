import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class ResumeCommand extends Command {
  readonly name = 'resume';
  readonly description = 'Resume a saved conversation thread';

  execute(_args: string, context: CommandContext): CommandOutcome {
    context.openDialog('resume');
    return { type: 'open-dialog', dialogId: 'resume' };
  }
}
