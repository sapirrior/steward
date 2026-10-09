import os from 'node:os';
import path from 'node:path';

export const STEWARD_HOME_DIR = path.join(os.homedir(), '.steward');
export const STEWARD_THREADS_DIR = path.join(STEWARD_HOME_DIR, 'threads');
export const STEWARD_SETTINGS_FILE = path.join(STEWARD_HOME_DIR, 'settings.json');
export const STEWARD_AUTH_FILE = path.join(STEWARD_HOME_DIR, 'auth.json');
