import { existsSync } from 'node:fs';
import { mkdir, readFile, unlink, open, rename } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  STEWARD_SETTINGS_FILE,
  STEWARD_HOME_DIR,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  DEFAULT_THEME,
  DEFAULT_REASONING_EFFORT,
  DEFAULT_TOOLS_STATE,
  DEFAULT_BASH_TIMEOUT_MS,
} from '../constants/index.js';
import type { StewardSettings } from './settingsTypes.js';

export const CANONICAL_DEFAULT_SETTINGS: StewardSettings = {
  version: 1,
  provider: DEFAULT_PROVIDER,
  model: DEFAULT_MODEL,
  theme: DEFAULT_THEME,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
  tools: { ...DEFAULT_TOOLS_STATE },
  bash: {
    autoApprove: false,
    timeoutMs: DEFAULT_BASH_TIMEOUT_MS,
  },
};

export class SettingsStorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    cause?: unknown,
  ) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SettingsStorageError';
  }
}

export class SettingsStore {
  private filePath: string;
  private cachedSettings: StewardSettings | null = null;

  constructor(filePath: string = STEWARD_SETTINGS_FILE) {
    this.filePath = filePath;
  }

  get settings(): StewardSettings {
    return this.cachedSettings ?? CANONICAL_DEFAULT_SETTINGS;
  }

  private deepMergeDefaults(partial: any): StewardSettings {
    if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
      return { ...CANONICAL_DEFAULT_SETTINGS, tools: { ...CANONICAL_DEFAULT_SETTINGS.tools }, bash: { ...CANONICAL_DEFAULT_SETTINGS.bash } };
    }

    return {
      version: 1,
      provider: typeof partial.provider === 'string' && partial.provider ? partial.provider : CANONICAL_DEFAULT_SETTINGS.provider,
      model: typeof partial.model === 'string' && partial.model ? partial.model : CANONICAL_DEFAULT_SETTINGS.model,
      theme: typeof partial.theme === 'string' && partial.theme ? partial.theme : CANONICAL_DEFAULT_SETTINGS.theme,
      reasoningEffort: partial.reasoningEffort || CANONICAL_DEFAULT_SETTINGS.reasoningEffort,
      tools: {
        read: partial.tools?.read ?? CANONICAL_DEFAULT_SETTINGS.tools.read,
        glob: partial.tools?.glob ?? CANONICAL_DEFAULT_SETTINGS.tools.glob,
        grep: partial.tools?.grep ?? CANONICAL_DEFAULT_SETTINGS.tools.grep,
        webfetch: partial.tools?.webfetch ?? CANONICAL_DEFAULT_SETTINGS.tools.webfetch,
        websearch: partial.tools?.websearch ?? CANONICAL_DEFAULT_SETTINGS.tools.websearch,
        bash: partial.tools?.bash ?? CANONICAL_DEFAULT_SETTINGS.tools.bash,
      },
      bash: {
        autoApprove: partial.bash?.autoApprove ?? CANONICAL_DEFAULT_SETTINGS.bash.autoApprove,
        timeoutMs: typeof partial.bash?.timeoutMs === 'number' ? partial.bash.timeoutMs : CANONICAL_DEFAULT_SETTINGS.bash.timeoutMs,
      },
    };
  }

  /**
   * Loads settings from disk with safe fallback and defaults merging.
   */
  async load(): Promise<StewardSettings> {
    if (!existsSync(this.filePath)) {
      this.cachedSettings = {
        ...CANONICAL_DEFAULT_SETTINGS,
        tools: { ...CANONICAL_DEFAULT_SETTINGS.tools },
        bash: { ...CANONICAL_DEFAULT_SETTINGS.bash },
      };
      return this.cachedSettings;
    }

    try {
      const raw = await readFile(this.filePath, 'utf-8');
      if (!raw.trim()) {
        this.cachedSettings = {
          ...CANONICAL_DEFAULT_SETTINGS,
          tools: { ...CANONICAL_DEFAULT_SETTINGS.tools },
          bash: { ...CANONICAL_DEFAULT_SETTINGS.bash },
        };
        return this.cachedSettings;
      }

      const parsed = JSON.parse(raw);
      this.cachedSettings = this.deepMergeDefaults(parsed);
      return this.cachedSettings;
    } catch {
      // Fall back safely to defaults on corrupt JSON
      this.cachedSettings = {
        ...CANONICAL_DEFAULT_SETTINGS,
        tools: { ...CANONICAL_DEFAULT_SETTINGS.tools },
        bash: { ...CANONICAL_DEFAULT_SETTINGS.bash },
      };
      return this.cachedSettings;
    }
  }

  /**
   * Atomically writes settings to disk.
   */
  async save(settings: StewardSettings): Promise<void> {
    const dir = path.dirname(this.filePath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {}

    const tempPath = path.join(
      dir,
      `.settings.tmp.${Date.now()}.${crypto.randomBytes(3).toString('hex')}.json`,
    );

    this.cachedSettings = this.deepMergeDefaults(settings);
    const serialized = JSON.stringify(this.cachedSettings, null, 2);

    try {
      const handle = await open(tempPath, 'w', 0o600);
      try {
        await handle.writeFile(serialized, 'utf-8');
        await handle.sync();
      } finally {
        await handle.close();
      }

      // Windows atomic rename retry loop
      let attempts = 0;
      const maxAttempts = 5;
      let delay = 20;

      while (true) {
        try {
          await rename(tempPath, this.filePath);
          break;
        } catch (err: any) {
          if (
            (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') &&
            attempts < maxAttempts
          ) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
          throw err;
        }
      }
    } catch (err: any) {
      try {
        if (existsSync(tempPath)) {
          await unlink(tempPath);
        }
      } catch {}
      throw new SettingsStorageError(
        `Failed to atomically save settings to ${this.filePath}`,
        'SAVE_FAILED',
        err,
      );
    }
  }

  /**
   * Partially updates settings and persists atomically.
   */
  async update(partial: Partial<StewardSettings>): Promise<StewardSettings> {
    const current = await this.load();
    const updated: StewardSettings = {
      ...current,
      ...partial,
      tools: {
        ...current.tools,
        ...(partial.tools || {}),
      },
      bash: {
        ...current.bash,
        ...(partial.bash || {}),
      },
    };

    await this.save(updated);
    return this.settings;
  }

  /**
   * Resets settings back to canonical defaults.
   */
  async reset(): Promise<StewardSettings> {
    const defaults = {
      ...CANONICAL_DEFAULT_SETTINGS,
      tools: { ...CANONICAL_DEFAULT_SETTINGS.tools },
      bash: { ...CANONICAL_DEFAULT_SETTINGS.bash },
    };
    await this.save(defaults);
    return defaults;
  }
}

export const settingsStore = new SettingsStore();
