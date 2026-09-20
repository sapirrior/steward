export type CliCommandKind = 'start' | 'version' | 'help' | 'repo' | 'config';

export interface CliConfigArgs {
  target: 'all' | 'voice' | 'theme' | 'model' | 'mode';
  value?: string;
}

export interface ParsedCliArgs {
  command: CliCommandKind;
  configArgs?: CliConfigArgs;
  rawArgs: string[];
}
