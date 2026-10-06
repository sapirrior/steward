import { REPO_URL } from '../../meta.js';
import type { CliCommand, CliContext, CliExitCode } from '../../types.js';

export const repoCommand: CliCommand = {
  name: 'repo',
  summary: 'Show official GitHub repository URL',
  usage: 'steward repo',
  run(_args: readonly string[], ctx: CliContext): CliExitCode {
    ctx.io.log(REPO_URL);
  },
};
