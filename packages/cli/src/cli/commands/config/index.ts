import type { CliCommand, CliContext, CliExitCode } from '../../types.js';
import { configTargets } from './targets.js';

export const configCommand: CliCommand = {
  name: 'config',
  summary: 'Configure persistent settings',
  usage: 'steward config mode <name>',
  run(args: readonly string[], ctx: CliContext): CliExitCode {
    const targetName = args[0]?.toLowerCase();
    const value = args[1]?.toLowerCase();

    if (!targetName || targetName === 'all') {
      ctx.io.log('Current settings:');
      for (const target of configTargets) {
        target.show(ctx.io);
      }
      return 0;
    }

    const matchedTarget = configTargets.find((t) => t.name === targetName);
    if (!matchedTarget) {
      const supported = configTargets.map((t) => t.name).join(', ');
      ctx.io.error(`Unknown configuration target "${targetName}". Supported: ${supported}`);
      return 1;
    }

    if (!value) {
      matchedTarget.get(ctx.io);
      return 0;
    }

    return matchedTarget.set(value, ctx.io);
  },
};
