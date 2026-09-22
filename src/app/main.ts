#!/usr/bin/env node
import { TUIApp } from './app.js';
import { AgentSession } from '@steward/agents/index.js';
import {
  logError,
  setupGlobalErrorHandlers,
  loadSettings,
  saveSettings,
  getSavedTheme,
  getSavedMode,
  saveThemeSelection,
  saveModeSelection,
} from '@steward/services/index.js';
import { setActiveTheme, listThemes, findTheme, getActiveThemeName } from '@steward/tui/index.js';
import { type ChatMode, MODE_NAMES } from '@steward/agents/index.js';
import pkg from '../../package.json' with { type: 'json' };

export const VERSION = pkg.version;
export const REPO_URL = 'https://github.com/sapirrior/steward';

// Suppress raw SDK warning output to prevent TUI screen corruption
(globalThis as any).AI_SDK_LOG_WARNINGS = false;

// Initialize production-grade global error handlers
setupGlobalErrorHandlers();

export function printHelp(): void {
  const themeNames = listThemes()
    .map((t) => t.name)
    .join(', ');
  console.log(`Steward — Interactive AI engineering assistant for the terminal

Usage:
  steward                        Launch the interactive terminal interface
  steward --help, -h             Show this help message
  steward --version, -v          Show steward version
  steward --repo, -r             Show official GitHub repository URL
  steward --config theme <name>  Configure preferred theme (${themeNames})
  steward --config mode <name>   Configure default mode (${MODE_NAMES.join(', ')})
`);
}

export function handleConfig(args: string[]): void {
  const target = args[0]?.toLowerCase();
  const value = args[1]?.toLowerCase();
  const availableThemes = listThemes().map((t) => t.name);

  if (!target || target === 'all') {
    const settings = loadSettings();
    console.log('Current settings:');
    console.log(`  Theme: ${settings.theme ?? 'dark (default)'}`);
    console.log(`  Mode: ${settings.mode ?? 'normal (default)'}`);
    return;
  }

  if (target === 'theme') {
    if (!value) {
      console.log(`Current theme: ${getSavedTheme() ?? 'dark'}`);
      console.log(`Available themes: ${availableThemes.join(', ')}`);
      return;
    }
    const match = findTheme(value);
    if (match) {
      saveThemeSelection(match.name);
      console.log(`Theme set to: ${match.name}`);
    } else {
      console.error(`Unknown theme "${value}". Available: ${availableThemes.join(', ')}`);
      process.exit(1);
    }
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

  console.error(`Unknown configuration target "${target}". Supported: theme, mode`);
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
    setActiveTheme(getSavedTheme() ?? 'dark');
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

// Auto-run if executed directly
if (import.meta.main) {
  run();
}
