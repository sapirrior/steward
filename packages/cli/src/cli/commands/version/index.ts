import { VERSION } from '../../meta.js';
import type { CliCommand, CliContext, CliExitCode } from '../../types.js';

export const versionCommand: CliCommand = {
  name: 'version',
  summary: 'Show steward version',
  usage: 'steward version',
  run(_args: readonly string[], ctx: CliContext): CliExitCode {
    ctx.io.log(`steward ${VERSION}`);
  },
};
