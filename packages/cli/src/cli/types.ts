export interface CliIO {
  log(message: string): void;
  error(message: string): void;
}

export interface CliContext {
  io: CliIO;
  registry: CliCommandRegistry;
}

export type CliExitCode = number | void;

export interface CliCommand {
  readonly name: string;
  readonly summary: string;
  readonly usage: string;
  run(args: readonly string[], ctx: CliContext): Promise<CliExitCode> | CliExitCode;
}

export interface CliCommandRegistry {
  register(command: CliCommand): this;
  resolve(token: string): CliCommand | undefined;
  getAll(): readonly CliCommand[];
}
