#!/usr/bin/env bun
/** @jsxImportSource stitchable */
/**
 * Root test harness for Steward interactive TUI.
 * Run directly with: `bun run tui.tsx`
 */
import { runInteractive } from './packages/cli/src/tui/index.js';
import { settingsStore } from './packages/cli/src/settings/settingsStore.js';

const settings = await settingsStore.load();

console.clear();
await runInteractive(settings);
