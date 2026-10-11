import { Command, type CommandContext, type CommandOutcome } from '../Command.js';

export class NewCommand extends Command {
  readonly name = 'new';
  override readonly alias = 'clear';
  readonly description = 'Start a new conversation thread';

  async execute(_args: string, context: CommandContext): Promise<CommandOutcome> {
    // 1. Save current active thread
    await context.threadController.saveActiveThread();
    // 2. Create fresh thread document
    context.threadController.createNewThread();
    return { type: 'action-complete', message: 'Started new conversation thread.' };
  }
}
