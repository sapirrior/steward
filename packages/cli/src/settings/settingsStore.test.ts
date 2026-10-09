import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { rm, writeFile, mkdir } from 'node:fs/promises';
import { SettingsStore, CANONICAL_DEFAULT_SETTINGS } from './settingsStore.js';

describe('SettingsStore Hardcore Test Suite', () => {
  let tempDir: string;
  let settingsFile: string;
  let store: SettingsStore;

  beforeEach(async () => {
    tempDir = path.join(
      os.tmpdir(),
      `steward-settings-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await mkdir(tempDir, { recursive: true });
    settingsFile = path.join(tempDir, 'settings.json');
    store = new SettingsStore(settingsFile);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ─── 1. Default Initialization ──────────────────────────────────────────────

  it('loads canonical defaults when settings file does not exist', async () => {
    const settings = await store.load();
    expect(settings.version).toBe(1);
    expect(settings.provider).toBe('google');
    expect(settings.model).toBe('gemini-flash-latest');
    expect(settings.theme).toBe('default');
    expect(settings.reasoningEffort).toBe('medium');

    // All 6 tools active by default
    expect(settings.tools.read).toBe(true);
    expect(settings.tools.glob).toBe(true);
    expect(settings.tools.grep).toBe(true);
    expect(settings.tools.webfetch).toBe(true);
    expect(settings.tools.websearch).toBe(true);
    expect(settings.tools.bash).toBe(true);

    // Bash defaults
    expect(settings.bash.autoApprove).toBe(false);
    expect(settings.bash.timeoutMs).toBe(60000);
  });

  // ─── 2. Atomic Save & Partial Merge ─────────────────────────────────────────

  it('saves settings atomically and merges partial configs cleanly', async () => {
    await store.update({
      theme: 'github',
      tools: {
        ...CANONICAL_DEFAULT_SETTINGS.tools,
        websearch: false,
      },
    });

    const reloaded = await store.load();
    expect(reloaded.theme).toBe('github');
    expect(reloaded.provider).toBe('google'); // Retained
    expect(reloaded.model).toBe('gemini-flash-latest'); // Retained
    expect(reloaded.tools.websearch).toBe(false); // Updated
    expect(reloaded.tools.read).toBe(true); // Retained
  });

  // ─── 3. Corrupt File Resilience ─────────────────────────────────────────────

  it('falls back to canonical defaults when settings JSON is corrupted', async () => {
    await writeFile(settingsFile, '{ "broken": json content !!!');

    const recovered = await store.load();
    expect(recovered.provider).toBe('google');
    expect(recovered.model).toBe('gemini-flash-latest');
    expect(recovered.theme).toBe('default');
  });

  it('handles empty settings files gracefully', async () => {
    await writeFile(settingsFile, '   \n  ');

    const recovered = await store.load();
    expect(recovered.provider).toBe('google');
    expect(recovered.model).toBe('gemini-flash-latest');
  });

  // ─── 4. Reset to Defaults ───────────────────────────────────────────────────

  it('resets settings back to canonical defaults', async () => {
    await store.update({
      provider: 'openai',
      model: 'gpt-4o',
      theme: 'github',
    });

    expect((await store.load()).model).toBe('gpt-4o');

    const reset = await store.reset();
    expect(reset.provider).toBe('google');
    expect(reset.model).toBe('gemini-flash-latest');
    expect(reset.theme).toBe('default');
  });

  // ─── 5. Concurrent Rapid Updates ────────────────────────────────────────────

  it('handles rapid sequential updates without file corruption', async () => {
    for (let i = 0; i < 20; i++) {
      await store.update({
        bash: {
          autoApprove: i % 2 === 0,
          timeoutMs: 10000 + i * 1000,
        },
      });
    }

    const final = await store.load();
    expect(final.bash.timeoutMs).toBe(29000);
    expect(final.provider).toBe('google');
  });
});
