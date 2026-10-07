import { MODE_NAMES, type ChatMode } from '../policy/modes.js';
import { loadSettings, saveSettings } from './store.js';

export { MODE_NAMES, type ChatMode };

export function getSavedMode(): ChatMode | undefined {
  const settings = loadSettings();
  if (
    settings.mode &&
    typeof settings.mode === 'string' &&
    (MODE_NAMES as readonly string[]).includes(settings.mode)
  ) {
    return settings.mode as ChatMode;
  }
  return undefined;
}

export function saveModeSelection(mode: ChatMode): void {
  saveSettings({
    mode,
  });
}
