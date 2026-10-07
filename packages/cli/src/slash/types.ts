import type { AgentSession } from '../query/index.js';

export interface CommandContext {
  session: AgentSession;
  cwd: string;
  getScreenLines?: () => string[];
}

export interface CommandResult {
  handled: boolean;
  message?: string;
  data?: any;
}

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  execute(args: string[], context: CommandContext): Promise<CommandResult>;
}
