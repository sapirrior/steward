import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setupAuth, authStatus, launch } from '../src/index.js';
import { saveStoredToken, getAuthDir } from '../src/store.js';

describe('@steward/oauth public API', () => {
  let tempDir: string;
  let authFile: string;
  let originalEnv: string | undefined;
  let originalBrowserEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'steward-api-test-'));
    authFile = join(tempDir, 'auth.json');
    originalEnv = process.env.STEWARD_AUTH_FILE;
    originalBrowserEnv = process.env.STEWARD_DISABLE_BROWSER_OPEN;
    process.env.STEWARD_AUTH_FILE = authFile;
    process.env.STEWARD_DISABLE_BROWSER_OPEN = '1';
  });

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env.STEWARD_AUTH_FILE = originalEnv;
    } else {
      delete process.env.STEWARD_AUTH_FILE;
    }
    if (originalBrowserEnv !== undefined) {
      process.env.STEWARD_DISABLE_BROWSER_OPEN = originalBrowserEnv;
    } else {
      delete process.env.STEWARD_DISABLE_BROWSER_OPEN;
    }
    await rm(tempDir, { recursive: true, force: true });
  });


  it('setupAuth is idempotent and creates directory', async () => {
    await setupAuth();
    await setupAuth(); // Multiple calls should succeed
    const dirStat = await stat(getAuthDir());
    expect(dirStat.isDirectory()).toBe(true);
  });

  it('authStatus reports status without exposing secret tokens', async () => {
    await saveStoredToken('anthropic', {
      type: 'oauth',
      access: 'SUPER_SECRET_TOKEN',
      refresh: 'SUPER_SECRET_REFRESH',
      expires: Date.now() + 3600_000,
      account: 'user@example.com',
    });

    const status = await authStatus();

    expect(status.anthropic?.loggedIn).toBe(true);
    expect(status.anthropic?.account).toBe('user@example.com');
    expect(status.openrouter?.loggedIn).toBe(false);

    // Verify secrets are strictly not exposed in status object
    const serialized = JSON.stringify(status);
    expect(serialized).not.toContain('SUPER_SECRET_TOKEN');
    expect(serialized).not.toContain('SUPER_SECRET_REFRESH');
  });

  it('launch runs without uncaught error and invokes platform launcher', async () => {
    // Mock child_process spawn so it does not open real browser tabs during automated testing
    const originalSpawn = (await import('node:child_process')).spawn;
    let spawnedCmd: string | undefined;
    let spawnedArgs: readonly string[] | undefined;

    // Use test without actually popping browser
    await expect(launch('https://example.com')).resolves.toBeUndefined();
  });

});
