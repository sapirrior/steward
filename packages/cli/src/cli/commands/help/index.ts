import type { CliCommand, CliContext, CliExitCode } from '../../types.js';

export function formatHelp(ctx: CliContext): string {
  const lines: string[] = [
    'Steward — Interactive AI engineering assistant for the terminal',
    '',
    'Usage:',
    '  steward                        Launch the interactive terminal interface',
  ];

  for (const cmd of ctx.registry.getAll()) {
    const paddedUsage = `  ${cmd.usage}`.padEnd(33, ' ');
    lines.push(`${paddedUsage}${cmd.summary}`);
  }

  lines.push('');
  return lines.join('\n');
}

export const helpCommand: CliCommand = {
  name: 'help',
  summary: 'Show this help message',
  usage: 'steward help',
  run(_args: readonly string[], ctx: CliContext): CliExitCode {
    ctx.io.log(formatHelp(ctx));
  },
};
