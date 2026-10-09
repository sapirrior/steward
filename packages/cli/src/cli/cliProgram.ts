import { Command } from 'commander';
import { VERSION } from './meta.js';
import { createConfigCommand } from './commands/configCommand.js';

export interface CliProgramOptions {
  onInteractive?: () => Promise<void> | void;
  onHeadlessPrompt?: (prompt: string) => Promise<void> | void;
}

export function createCliProgram(options: CliProgramOptions = {}): Command {
  const program = new Command();

  program
    .name('steward')
    .description('Steward - Interactive AI engineering assistant for the terminal')
    .version(VERSION, '-v, --version', 'Output the current version')
    .helpOption('-h, --help', 'Display help for command')
    .argument('[prompt]', 'Prompt to run in headless non-interactive mode')
    .action(async (prompt?: string) => {
      if (typeof prompt === 'string' && prompt.trim().length > 0) {
        // Headless execution: run prompt directly without opening interactive CLI
        if (options.onHeadlessPrompt) {
          await options.onHeadlessPrompt(prompt.trim());
        } else {
          const { runHeadlessPrompt } = await import('../query/index.js');
          await runHeadlessPrompt(prompt.trim());
        }
        return;
      }

      // No prompt given: launch interactive TUI REPL
      if (options.onInteractive) {
        await options.onInteractive();
      }
    });

  // Attach configuration management commands
  program.addCommand(createConfigCommand());

  return program;
}
