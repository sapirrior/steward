import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import {
  loadSettings,
  saveSettings,
  getSettingsDir,
  getSettingsPath,
} from '../src/packages/services/src/config/settings.js';
import {
  getSessionsRootDir,
  getSessionFilePath,
  loadSession,
} from '../src/packages/services/src/session/store.js';
import { parseSessionDocument } from '../src/packages/services/src/session/validate.js';
import { getPlatformShell } from '../src/packages/services/src/tasks/shell.js';

describe('Phase 1 Compatibility & Invariants Safety Net', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1.1 Path Equivalence', () => {
    it('resolves default ~/.steward paths when no env overrides set', () => {
      delete process.env.STEWARD_SETTINGS_DIR;
      delete process.env.STEWARD_SESSIONS_DIR;
      delete process.env.STEWARD_LOGS_DIR;

      const baseSteward = join(homedir(), '.steward');
      expect(getSettingsDir()).toBe(baseSteward);
      expect(getSettingsPath()).toBe(join(baseSteward, 'settings.json'));
      expect(getSessionsRootDir()).toBe(join(baseSteward, 'sessions'));
      expect(getSessionFilePath('2026-09-21', 'sess123')).toBe(
        join(baseSteward, 'sessions', '2026-09-21', 'sess123.json'),
      );
    });

    it('honors environment overrides correctly', () => {
      const customSettings = '/tmp/custom-steward-settings';
      const customSessions = '/tmp/custom-steward-sessions';
      process.env.STEWARD_SETTINGS_DIR = customSettings;
      process.env.STEWARD_SESSIONS_DIR = customSessions;

      expect(getSettingsDir()).toBe(customSettings);
      expect(getSettingsPath()).toBe(join(customSettings, 'settings.json'));
      expect(getSessionsRootDir()).toBe(customSessions);
      expect(getSessionFilePath('2026-09-21', 'sess123')).toBe(
        join(customSessions, '2026-09-21', 'sess123.json'),
      );
    });
  });

  describe('1.2 Settings Backward Compatibility & Key Preservation', () => {
    it('loads settings with voiceLanguage and unknown custom fields without throwing', () => {
      const fixtureDir = join(import.meta.dir, 'fixtures', 'steward-home');
      process.env.STEWARD_SETTINGS_DIR = fixtureDir;

      const settings = loadSettings();
      expect(settings.theme).toBe('monokai');
      expect(settings.mode).toBe('normal');
      expect(settings.voiceLanguage).toBe('en-US');
      expect((settings as any).customFieldForCompatibility).toBe('preserved-value');
    });

    it('preserves unknown/legacy keys when saving new settings', () => {
      const testDir = join(tmpdir(), `steward-test-settings-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      process.env.STEWARD_SETTINGS_DIR = testDir;

      // Seed with legacy settings
      saveSettings({
        voiceLanguage: 'fr-FR',
        theme: 'default',
        ...({ customLegacyKey: 'must-not-be-stripped' } as any),
      });

      // Update theme
      saveSettings({ theme: 'dracula' });

      const loaded = loadSettings();
      expect(loaded.theme).toBe('dracula');
      expect(loaded.voiceLanguage).toBe('fr-FR');
      expect((loaded as any).customLegacyKey).toBe('must-not-be-stripped');

      rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('1.3 Session Schema v1 Freeze', () => {
    it('validates and loads a canonical schemaVersion 1 session document', () => {
      const fixturePath = join(
        import.meta.dir,
        'fixtures',
        'steward-home',
        'sessions',
        '2026-09-21',
        'session1.json',
      );
      const raw = readFileSync(fixturePath, 'utf-8');
      const res = parseSessionDocument(raw);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.doc.schemaVersion).toBe(1);
        expect(res.doc.id).toBe('session1');
        expect(res.doc.turns.length).toBe(1);
        expect(res.doc.turns[0]?.status).toBe('complete');
      }
    });
  });

  describe('1.6 Shell Resolver Guard', () => {
    it('services/tasks/shell returns valid shell configuration', () => {
      const shell = getPlatformShell();
      expect(typeof shell.shell).toBe('string');
      expect(Array.isArray(shell.args)).toBe(true);
    });
  });
});
