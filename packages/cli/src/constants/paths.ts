import os from 'node:os';
import path from 'node:path';

export const STEWARD_SETTINGS_FILE = path.join(os.homedir(), '.steward', 'settings.json');
