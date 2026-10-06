import { bugCommand } from './bug/index.js';
import { clearCommand } from './clear/index.js';
import { copyCommand } from './copy/index.js';
import { exportCommand } from './export/index.js';
import { initCommand } from './init/index.js';
import { usageCommand } from './usage/index.js';
import { effortCommand } from './effort/index.js';
import { exitCommand, quitCommand } from './exit/index.js';
import { modelCommand } from './model/index.js';
import { renameCommand } from './rename/index.js';
import { resumeCommand } from './resume/index.js';
import { rewindCommand } from './rewind/index.js';
import { skillsCommand } from './skills/index.js';
import { modeCommand } from './mode/index.js';
import { loginCommand } from './login/index.js';
import { logoutCommand } from './logout/index.js';
import { CommandRegistry } from './registry.js';
import type { SlashCommand } from './types.js';

export const builtInCommands: SlashCommand[] = [
  bugCommand,
  initCommand,
  copyCommand,
  exportCommand,
  usageCommand,
  rewindCommand,
  modelCommand,
  effortCommand,
  modeCommand,
  loginCommand,
  logoutCommand,
  clearCommand,
  exitCommand,
  quitCommand,
  resumeCommand,
  renameCommand,
  skillsCommand,
];

/**
 * Default command registry populated with standard slash commands.
 */
export const defaultCommandRegistry = new CommandRegistry();
for (const cmd of builtInCommands) {
  defaultCommandRegistry.register(cmd);
}
