#!/usr/bin/env node
/**
 * @file main.ts
 * @description Steward CLI entrypoint with -m, -p, -v flags and Stitchable UI mounting.
 */

import { Command } from 'commander';
import { render } from 'stitchable';
import { settingsStore } from './settings/settingsStore.js';
import { themeManager } from './themes/index.js';
import { App } from './ui/App.js';

const VERSION = '0.38.0';

async function main() {
  const program = new Command();

  program
    .name('steward')
    .description('Interactive AI engineering assistant for the terminal')
    .version(VERSION, '-v, --version', 'Output the version number')
    .option('-m, --model <model>', 'LLM model identifier to use')
    .option('-p, --provider <provider>', 'LLM provider name')
    .parse(process.argv);

  const opts = program.opts<{
    model?: string;
    provider?: string;
  }>();

  // Load user settings
  const settings = await settingsStore.load();
  await themeManager.loadFromSettings();

  const provider = (opts.provider || settings.provider || 'google').toLowerCase();
  const model = opts.model || settings.model || 'gemini-flash-latest';
  const cwd = process.cwd();
  const reasoningEffort = settings.reasoningEffort;

  // Mount interactive TUI
  const app = render(
    <App
      version={VERSION}
      provider={provider}
      model={model}
      cwd={cwd}
      reasoningEffort={reasoningEffort}
    />,
  );

  await app.waitUntilExit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
