import os from 'node:os';
import path from 'node:path';

export const STEWARD_CONFIG_DIR = path.join(os.homedir(), '.steward');
export const STEWARD_SETTINGS_FILE = path.join(STEWARD_CONFIG_DIR, 'settings.json');
export const STEWARD_HISTORY_FILE = path.join(STEWARD_CONFIG_DIR, 'history.jsonl');
