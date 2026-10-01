#!/usr/bin/env node
import { TUIApp } from './app.js';
import {
  AgentSession,
  logError,
  setupGlobalErrorHandlers,
  loadSettings,
  getSavedMode,
  saveModeSelection,
  type ChatMode,
  MODE_NAMES,
} from '@steward/agent';
import pkg from '../package.json' with { type: 'json' };

export const VERSION = pkg.version;
export const REPO_URL = 'https://github.com/sapirrior/steward';

// Initialize production-grade global error handlers
setupGlobalErrorHandlers();

export function printHelp(): void {
  console.log(`Steward — Interactive AI engineering assistant for the terminal

Usage:
  steward                        Launch the interactive terminal interface
  steward --help, -h             Show this help message
  steward --version, -v          Show steward version
  steward --repo, -r             Show official GitHub repository URL
  steward --config mode <name>   Configure default mode (${MODE_NAMES.join(', ')})
`);
}

export function handleConfig(args: string[]): void {
  const target = args[0]?.toLowerCase();
  const value = args[1]?.toLowerCase();

  if (!target || target === 'all') {
    const settings = loadSettings();
    console.log('Current settings:');
    console.log(`  Mode: ${settings.mode ?? 'normal (default)'}`);
    return;
  }

  if (target === 'mode') {
    if (!value) {
      console.log(`Current default mode: ${getSavedMode() ?? 'normal'}`);
      console.log(`Available modes: ${MODE_NAMES.join(', ')}`);
      return;
    }
    if (MODE_NAMES.includes(value as ChatMode)) {
      saveModeSelection(value as ChatMode);
      console.log(`Default mode set to: ${value}`);
    } else {
      console.error(`Unknown mode "${value}". Available: ${MODE_NAMES.join(', ')}`);
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown configuration target "${target}". Supported: mode`);
  process.exit(1);
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const first = argv[0];

  if (first === '-v' || first === '--version' || first === 'version') {
    console.log(`steward ${VERSION}`);
    return;
  }

  if (first === '-h' || first === '--help' || first === 'help') {
    printHelp();
    return;
  }

  if (first === '-r' || first === '--repo' || first === 'repo') {
    console.log(REPO_URL);
    return;
  }

  if (first === '--config' || first === 'config') {
    handleConfig(argv.slice(1));
    return;
  }

  if (first && first.startsWith('-')) {
    console.error(`Unknown option "${first}". Run "steward --help" for usage.`);
    process.exit(1);
  }

  if (first) {
    console.error(`Unknown argument "${first}". Run "steward --help" for usage.`);
    process.exit(1);
  }

  try {
    const session = new AgentSession();
    const app = new TUIApp({
      version: VERSION,
      initialSession: session,
      cwd: process.cwd(),
      onExit: () => process.exit(0),
    });
    await app.start();
  } catch (err) {
    logError(err, { phase: 'initialization' });
    console.error(
      'Failed to initialize steward:',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}

// Auto-run entrypoint
run();
