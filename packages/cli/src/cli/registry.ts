import type { CliCommand, CliCommandRegistry } from './types.js';

export class DefaultCliCommandRegistry implements CliCommandRegistry {
  private commands = new Map<string, CliCommand>();

  public register(command: CliCommand): this {
    if (this.commands.has(command.name)) {
      throw new Error(`Duplicate CLI command name registered: "${command.name}"`);
    }
    this.commands.set(command.name, command);
    return this;
  }

  public resolve(token: string): CliCommand | undefined {
    return this.commands.get(token);
  }

  public getAll(): readonly CliCommand[] {
    return Array.from(this.commands.values());
  }
}
