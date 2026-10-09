import { Command } from 'commander';
import { SettingsStore, settingsStore } from '../../settings/settingsStore.js';
import type { StewardSettings } from '../../settings/settingsTypes.js';

export const ALLOWED_CONFIG_KEYS = [
  'provider',
  'model',
  'theme',
  'reasoningEffort',
  'tools.read',
  'tools.glob',
  'tools.grep',
  'tools.webfetch',
  'tools.websearch',
  'tools.bash',
  'bash.autoApprove',
  'bash.timeoutMs',
] as const;

export type AllowedConfigKey = (typeof ALLOWED_CONFIG_KEYS)[number];

export function getSettingByPath(settings: StewardSettings, key: string): unknown {
  const parts = key.split('.');
  if (parts.length === 1) {
    const k = parts[0] as keyof StewardSettings;
    if (k in settings) {
      return settings[k];
    }
  } else if (parts.length === 2) {
    const [section, subkey] = parts;
    if (section === 'tools' && subkey && subkey in settings.tools) {
      return settings.tools[subkey as keyof typeof settings.tools];
    }
    if (section === 'bash' && subkey && subkey in settings.bash) {
      return settings.bash[subkey as keyof typeof settings.bash];
    }
  }
  throw new Error(`Unknown configuration key "${key}". Allowed keys: ${ALLOWED_CONFIG_KEYS.join(', ')}`);
}

export function setSettingByPath(
  current: StewardSettings,
  key: string,
  rawValue: string,
): StewardSettings {
  const updated: StewardSettings = {
    ...current,
    tools: { ...current.tools },
    bash: { ...current.bash },
  };

  if (key === 'provider') {
    if (!rawValue.trim()) {
      throw new Error('Provider cannot be empty');
    }
    updated.provider = rawValue.trim();
    return updated;
  }

  if (key === 'model') {
    if (!rawValue.trim()) {
      throw new Error('Model cannot be empty');
    }
    updated.model = rawValue.trim();
    return updated;
  }

  if (key === 'theme') {
    if (!rawValue.trim()) {
      throw new Error('Theme cannot be empty');
    }
    updated.theme = rawValue.trim();
    return updated;
  }

  if (key === 'reasoningEffort') {
    const val = rawValue.trim().toLowerCase();
    if (val !== 'low' && val !== 'medium' && val !== 'high') {
      throw new Error(`Invalid reasoningEffort "${rawValue}". Allowed: low, medium, high`);
    }
    updated.reasoningEffort = val;
    return updated;
  }

  if (key.startsWith('tools.')) {
    const sub = key.slice('tools.'.length) as keyof typeof updated.tools;
    if (!(sub in updated.tools)) {
      throw new Error(`Unknown tool "${sub}". Allowed: read, glob, grep, webfetch, websearch, bash`);
    }
    const lower = rawValue.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes') {
      updated.tools[sub] = true;
    } else if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no') {
      updated.tools[sub] = false;
    } else {
      throw new Error(`Invalid boolean value for ${key}: "${rawValue}". Use "true" or "false"`);
    }
    return updated;
  }

  if (key === 'bash.autoApprove') {
    const lower = rawValue.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'on' || lower === 'yes') {
      updated.bash.autoApprove = true;
    } else if (lower === 'false' || lower === '0' || lower === 'off' || lower === 'no') {
      updated.bash.autoApprove = false;
    } else {
      throw new Error(`Invalid boolean value for ${key}: "${rawValue}". Use "true" or "false"`);
    }
    return updated;
  }

  if (key === 'bash.timeoutMs') {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid timeout value for ${key}: "${rawValue}". Must be a positive integer in milliseconds.`);
    }
    updated.bash.timeoutMs = Math.round(parsed);
    return updated;
  }

  throw new Error(`Unknown configuration key "${key}". Allowed keys: ${ALLOWED_CONFIG_KEYS.join(', ')}`);
}

export function createConfigCommand(store: SettingsStore = settingsStore): Command {
  const configCmd = new Command('config')
    .alias('settings')
    .description('View and modify Steward configuration in settings.json')
    .action(async () => {
      // Default action when running `steward config`: list all settings
      const settings = await store.load();
      console.log(JSON.stringify(settings, null, 2));
    });

  configCmd
    .command('list')
    .description('List all current configuration values')
    .action(async () => {
      const settings = await store.load();
      console.log(JSON.stringify(settings, null, 2));
    });

  configCmd
    .command('get <key>')
    .description('Get the current value for a configuration key')
    .action(async (key: string) => {
      try {
        const settings = await store.load();
        const val = getSettingByPath(settings, key);
        if (typeof val === 'object' && val !== null) {
          console.log(JSON.stringify(val, null, 2));
        } else {
          console.log(String(val));
        }
      } catch (err: any) {
        console.error(err.message ?? String(err));
        process.exitCode = 1;
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration key to a new value')
    .action(async (key: string, value: string) => {
      try {
        const current = await store.load();
        const updated = setSettingByPath(current, key, value);
        await store.save(updated);
        console.log(`Updated ${key} = ${getSettingByPath(updated, key)}`);
      } catch (err: any) {
        console.error(err.message ?? String(err));
        process.exitCode = 1;
      }
    });

  configCmd
    .command('reset')
    .description('Reset configuration back to canonical defaults')
    .action(async () => {
      await store.reset();
      console.log('Reset settings to canonical defaults.');
    });

  return configCmd;
}
