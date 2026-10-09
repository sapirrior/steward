import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getSettingByPath,
  setSettingByPath,
  createConfigCommand,
  ALLOWED_CONFIG_KEYS,
} from './configCommand.js';
import { SettingsStore, CANONICAL_DEFAULT_SETTINGS } from '../../settings/settingsStore.js';
import type { StewardSettings } from '../../settings/settingsTypes.js';

describe('configCommand helpers', () => {
  let initialSettings: StewardSettings;

  beforeEach(() => {
    initialSettings = {
      ...CANONICAL_DEFAULT_SETTINGS,
      tools: { ...CANONICAL_DEFAULT_SETTINGS.tools },
      bash: { ...CANONICAL_DEFAULT_SETTINGS.bash },
    };
  });

  it('should retrieve top-level and nested settings by key', () => {
    expect(getSettingByPath(initialSettings, 'provider')).toBe('google');
    expect(getSettingByPath(initialSettings, 'model')).toBe('gemini-flash-latest');
    expect(getSettingByPath(initialSettings, 'theme')).toBe('default');
    expect(getSettingByPath(initialSettings, 'reasoningEffort')).toBe('medium');
    expect(getSettingByPath(initialSettings, 'tools.read')).toBe(true);
    expect(getSettingByPath(initialSettings, 'tools.bash')).toBe(true);
    expect(getSettingByPath(initialSettings, 'bash.autoApprove')).toBe(false);
    expect(getSettingByPath(initialSettings, 'bash.timeoutMs')).toBe(60000);
  });

  it('should throw for unknown get key', () => {
    expect(() => getSettingByPath(initialSettings, 'unknown.key')).toThrow(/Unknown configuration key/);
    expect(() => getSettingByPath(initialSettings, 'nonExistent')).toThrow(/Unknown configuration key/);
  });

  it('should update string settings correctly', () => {
    const updatedModel = setSettingByPath(initialSettings, 'model', 'gemini-2.5-pro');
    expect(updatedModel.model).toBe('gemini-2.5-pro');

    const updatedTheme = setSettingByPath(initialSettings, 'theme', 'github');
    expect(updatedTheme.theme).toBe('github');

    const updatedProvider = setSettingByPath(initialSettings, 'provider', 'anthropic');
    expect(updatedProvider.provider).toBe('anthropic');
  });

  it('should validate and update reasoningEffort', () => {
    const updated = setSettingByPath(initialSettings, 'reasoningEffort', 'high');
    expect(updated.reasoningEffort).toBe('high');

    expect(() => setSettingByPath(initialSettings, 'reasoningEffort', 'invalid')).toThrow(/Invalid reasoningEffort/);
  });

  it('should update boolean tool settings with various truthy/falsy inputs', () => {
    const t1 = setSettingByPath(initialSettings, 'tools.websearch', 'false');
    expect(t1.tools.websearch).toBe(false);

    const t2 = setSettingByPath(t1, 'tools.websearch', 'true');
    expect(t2.tools.websearch).toBe(true);

    const t3 = setSettingByPath(initialSettings, 'bash.autoApprove', '1');
    expect(t3.bash.autoApprove).toBe(true);

    const t4 = setSettingByPath(t3, 'bash.autoApprove', 'off');
    expect(t4.bash.autoApprove).toBe(false);

    expect(() => setSettingByPath(initialSettings, 'tools.read', 'invalid')).toThrow(/Invalid boolean value/);
  });

  it('should update and validate numeric bash.timeoutMs', () => {
    const updated = setSettingByPath(initialSettings, 'bash.timeoutMs', '60000');
    expect(updated.bash.timeoutMs).toBe(60000);

    expect(() => setSettingByPath(initialSettings, 'bash.timeoutMs', '-100')).toThrow(/Must be a positive integer/);
    expect(() => setSettingByPath(initialSettings, 'bash.timeoutMs', 'not-a-number')).toThrow(/Must be a positive integer/);
  });
});

describe('createConfigCommand integration with SettingsStore', () => {
  let tempDir: string;
  let store: SettingsStore;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'steward-config-test-'));
    store = new SettingsStore(path.join(tempDir, 'settings.json'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should execute get and set commands through Commander', async () => {
    const cmd = createConfigCommand(store);
    cmd.exitOverride();

    // Set model
    await cmd.parseAsync(['set', 'model', 'claude-3-7-sonnet'], { from: 'user' });
    const loaded = await store.load();
    expect(loaded.model).toBe('claude-3-7-sonnet');

    // Reset
    await cmd.parseAsync(['reset'], { from: 'user' });
    const reset = await store.load();
    expect(reset.model).toBe('gemini-flash-latest');
  });
});
