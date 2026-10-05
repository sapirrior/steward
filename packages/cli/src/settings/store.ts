import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getStewardHomeDir, atomicWriteFileSync } from '@steward/agent';
import type { ChatMode } from '@steward/agent';
import type { ProviderId, ReasoningEffort } from '@steward/ai';

export interface SavedModelSettings {
  provider: ProviderId;
  modelId: string;
  effort?: ReasoningEffort;
}

export interface TrustedFolderRecord {
  trustedAt: string;
}

export interface UserSettings {
  model?: SavedModelSettings;
  trustedFolders?: Record<string, TrustedFolderRecord>;
  mode?: ChatMode;
  [key: string]: unknown;
}

export function getSettingsPath(): string {
  return join(getStewardHomeDir(), 'settings.json');
}

/**
 * Safely loads user settings from settings.json.
 * Returns default empty object if file does not exist or JSON is invalid.
 */
export function loadSettings(): UserSettings {
  const filePath = getSettingsPath();
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as UserSettings;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Saves and updates user settings atomically using atomicWriteFileSync,
 * preserving all unknown and legacy keys.
 */
export function saveSettings(updates: Partial<UserSettings>): UserSettings {
  const current = loadSettings();
  const updated: UserSettings = {
    ...current,
    ...updates,
  };

  const filePath = getSettingsPath();
  atomicWriteFileSync(filePath, JSON.stringify(updated, null, 2) + '\n');
  return updated;
}
