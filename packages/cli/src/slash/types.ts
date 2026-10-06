import type { AgentSession } from '@steward/agent';

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
