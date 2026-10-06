import type { CliCommand } from '../types.js';
import { versionCommand } from './version/index.js';
import { helpCommand } from './help/index.js';
import { repoCommand } from './repo/index.js';
import { configCommand } from './config/index.js';

export * from './version/index.js';
export * from './help/index.js';
export * from './repo/index.js';
export * from './config/index.js';

export const builtInCliCommands: readonly CliCommand[] = [
  helpCommand,
  versionCommand,
  repoCommand,
  configCommand,
];
