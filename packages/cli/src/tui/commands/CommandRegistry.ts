import type { Command, CommandContext, CommandOutcome } from './Command.js';
import { NewCommand } from './NewCommand/NewCommand.js';
import { ModelCommand } from './ModelCommand/ModelCommand.js';
import { EffortCommand } from './EffortCommand/EffortCommand.js';
import { ThemeCommand } from './ThemeCommand/ThemeCommand.js';
import { SettingsCommand } from './SettingsCommand/SettingsCommand.js';
import { ResumeCommand } from './ResumeCommand/ResumeCommand.js';
import { ExitCommand } from './ExitCommand/ExitCommand.js';

export interface CommandLookupResult {
  command: Command;
  rawInput: string;
  args: string;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();
  private readonly aliasMap = new Map<string, string>(); // alias -> canonical name

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    this.register(new NewCommand());
    this.register(new ModelCommand());
    this.register(new EffortCommand());
    this.register(new ThemeCommand());
    this.register(new SettingsCommand());
    this.register(new ResumeCommand());
    this.register(new ExitCommand());
  }

  /**
   * Registers a command into the registry and indexes its single alias.
   */
  register(command: Command): void {
    const canonical = command.name.toLowerCase();
    this.commands.set(canonical, command);

    if (command.alias) {
      this.aliasMap.set(command.alias.toLowerCase(), canonical);
    }
  }

  /**
   * Finds a command by its canonical name or single alias.
   */
  get(nameOrAlias: string): Command | undefined {
    const clean = nameOrAlias.trim().toLowerCase().replace(/^\//, '');
    if (!clean) return undefined;

    // 1. Direct canonical match
    const direct = this.commands.get(clean);
    if (direct) return direct;

    // 2. Alias resolution
    const canonicalName = this.aliasMap.get(clean);
    if (canonicalName) {
      return this.commands.get(canonicalName);
    }

    return undefined;
  }

  /**
   * Returns all registered commands in registration order.
   */
  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  /**
   * Matches commands for autocomplete palette filtering.
   */
  filter(query: string): Command[] {
    const clean = query.trim().toLowerCase().replace(/^\//, '');
    if (!clean) return this.getAll();

    return this.getAll().filter((cmd) => {
      if (cmd.name.toLowerCase().startsWith(clean)) return true;
      if (cmd.alias && cmd.alias.toLowerCase().startsWith(clean)) return true;
      return false;
    });
  }

  /**
   * Parses and executes a user command string (e.g. "/new", "/settings", "/model google/gemini-2.5-flash").
   */
  async execute(input: string, context: CommandContext): Promise<CommandOutcome> {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) {
      return { type: 'error', message: 'Not a valid slash command' };
    }

    const withoutSlash = trimmed.slice(1).trim();
    const spaceIndex = withoutSlash.indexOf(' ');
    const commandName = spaceIndex === -1 ? withoutSlash : withoutSlash.slice(0, spaceIndex);
    const args = spaceIndex === -1 ? '' : withoutSlash.slice(spaceIndex + 1).trim();

    const cmd = this.get(commandName);
    if (!cmd) {
      return {
        type: 'error',
        message: `Unknown command "/${commandName}". Type / to see available commands.`,
      };
    }

    return await cmd.execute(args, context);
  }
}

export const commandRegistry = new CommandRegistry();
export const BUILTIN_COMMANDS = commandRegistry.getAll();
export type SlashCommand = Command;
