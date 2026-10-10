/** @jsxImportSource stitchable */
import { render } from 'stitchable';
import { App } from './App.js';
import type { StewardSettings } from '../settings/settingsTypes.js';
import { settingsStore } from '../settings/settingsStore.js';

export async function runInteractive(settings?: StewardSettings): Promise<void> {
  const resolvedSettings = settings ?? (await settingsStore.load());
  const handle = render(<App settings={resolvedSettings} />, {
    mouse: true,
    exitOnCtrlC: false, // Handled inside App.tsx for graceful interruption
  });

  await handle.waitUntilExit();
}

export * from './types.js';
export { App } from './App.js';
