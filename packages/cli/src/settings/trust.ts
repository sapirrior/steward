import { sep } from 'node:path';
import { normalizeFolderPath } from '@steward/agent';
import { loadSettings, saveSettings } from './store.js';

/**
 * Checks whether a folder (or any of its ancestor directories) is trusted in settings.json.
 */
export function isFolderTrusted(absolutePath: string): boolean {
  const normalized = normalizeFolderPath(absolutePath);
  const settings = loadSettings();
  const trusted = settings.trustedFolders ?? {};

  if (trusted[normalized]) {
    return true;
  }

  // Check recursive trust: if an ancestor of this folder is trusted
  for (const trustedKey of Object.keys(trusted)) {
    const prefix = trustedKey.endsWith(sep) ? trustedKey : `${trustedKey}${sep}`;
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

/**
 * Marks a folder as trusted in settings.json.
 */
export function trustFolder(absolutePath: string): void {
  const normalized = normalizeFolderPath(absolutePath);
  const current = loadSettings();
  saveSettings({
    trustedFolders: {
      ...(current.trustedFolders ?? {}),
      [normalized]: {
        trustedAt: new Date().toISOString(),
      },
    },
  });
}
