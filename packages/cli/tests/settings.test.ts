import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadSettings,
  saveSettings,
  getSettingsPath,
  getSavedModel,
  saveModel,
  normalizeReasoningEffort,
  getSavedMode,
  saveModeSelection,
  isFolderTrusted,
  trustFolder,
} from '../src/settings/index.js';

describe('CLI Settings & Trust Management (S9)', () => {
  const originalEnv = { ...process.env };
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `steward-test-cli-settings-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });
    process.env = { ...originalEnv, STEWARD_SETTINGS_DIR: testDir };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    rmSync(testDir, { recursive: true, force: true });
  });

  it('loadSettings returns empty object if file does not exist or is malformed', () => {
    expect(loadSettings()).toEqual({});

    const settingsPath = getSettingsPath();
    writeFileSync(settingsPath, 'not-json-content', 'utf-8');
    expect(loadSettings()).toEqual({});

    writeFileSync(settingsPath, '[]', 'utf-8');
    expect(loadSettings()).toEqual({});
  });

  it('saveSettings preserves unknown/legacy keys and writes atomically', () => {
    const settingsPath = getSettingsPath();

    // Seed file with arbitrary unknown or legacy fields
    writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          legacyTheme: 'monokai',
          voiceLanguage: 'en-US',
          customKey: 'preserve-me',
        },
        null,
        2,
      ),
      'utf-8',
    );

    saveSettings({ mode: 'chat' });

    const loaded = loadSettings();
    expect(loaded.mode).toBe('chat');
    expect(loaded['legacyTheme']).toBe('monokai');
    expect(loaded['voiceLanguage']).toBe('en-US');
    expect(loaded['customKey']).toBe('preserve-me');
  });

  it('model settings remaps legacy gemini provider to google and normalizes effort', () => {
    expect(getSavedModel()).toBeUndefined();

    saveSettings({
      model: {
        provider: 'gemini' as any,
        modelId: 'gemini-2.5-flash',
        effort: 'high' as any,
      },
    });

    const model = getSavedModel();
    expect(model).toBeDefined();
    expect(model?.provider).toBe('google');
    expect(model?.modelId).toBe('gemini-2.5-flash');
    expect(model?.effort).toBe('high');

    saveModel({
      provider: 'openai',
      modelId: 'gpt-4o',
      effort: 'low',
    });

    const updated = getSavedModel();
    expect(updated?.provider).toBe('openai');
    expect(updated?.modelId).toBe('gpt-4o');
    expect(updated?.effort).toBe('low');
  });

  it('normalizeReasoningEffort correctly normalizes all input variations', () => {
    expect(normalizeReasoningEffort('none')).toBe('none');
    expect(normalizeReasoningEffort('off')).toBe('none');
    expect(normalizeReasoningEffort('0')).toBe('none');
    expect(normalizeReasoningEffort('low')).toBe('low');
    expect(normalizeReasoningEffort('minimal')).toBe('low');
    expect(normalizeReasoningEffort('1')).toBe('low');
    expect(normalizeReasoningEffort('medium')).toBe('medium');
    expect(normalizeReasoningEffort('high')).toBe('high');
    expect(normalizeReasoningEffort('xhigh')).toBe('xhigh');
    expect(normalizeReasoningEffort('max')).toBe('xhigh');
    expect(normalizeReasoningEffort(null)).toBe('medium');
    expect(normalizeReasoningEffort(undefined)).toBe('medium');
  });

  it('mode settings loads and saves valid modes only', () => {
    expect(getSavedMode()).toBeUndefined();

    saveModeSelection('review');
    expect(getSavedMode()).toBe('review');

    saveSettings({ mode: 'invalid-mode' as any });
    expect(getSavedMode()).toBeUndefined();
  });

  it('trust management checks exact and recursive ancestor directory trust', () => {
    const parentDir = join(testDir, 'workspace');
    const childDir = join(parentDir, 'subproject', 'src');
    mkdirSync(childDir, { recursive: true });

    expect(isFolderTrusted(parentDir)).toBe(false);
    expect(isFolderTrusted(childDir)).toBe(false);

    trustFolder(parentDir);

    expect(isFolderTrusted(parentDir)).toBe(true);
    expect(isFolderTrusted(childDir)).toBe(true);

    const outsideDir = join(testDir, 'other-project');
    mkdirSync(outsideDir, { recursive: true });
    expect(isFolderTrusted(outsideDir)).toBe(false);
  });
});
