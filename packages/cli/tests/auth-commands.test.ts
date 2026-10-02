import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loginCommand } from '../src/commands/login/index.js';
import { logoutCommand } from '../src/commands/logout/index.js';
import { defaultCommandRegistry } from '../src/commands/registry.js';

describe('Slash Commands: /login and /logout', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'steward-auth-cmd-test-'));
    process.env.STEWARD_AUTH_DIR = tempDir;
    process.env.STEWARD_DISABLE_BROWSER_OPEN = '1';
  });

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    delete process.env.STEWARD_AUTH_DIR;
    delete process.env.STEWARD_DISABLE_BROWSER_OPEN;
  });

  it('should register /login and /logout in default command registry', () => {
    expect(defaultCommandRegistry.get('login')).toBeDefined();
    expect(defaultCommandRegistry.get('logout')).toBeDefined();
  });

  it('should return showLoginPicker when /login is called without args', async () => {
    const result = await loginCommand.execute([], {
      cwd: tempDir,
      session: {} as any,
    });

    expect(result.handled).toBe(true);
    expect(result.data?.showLoginPicker).toBe(true);
    expect(Array.isArray(result.data?.providers)).toBe(true);
    expect(result.data.providers.length).toBeGreaterThanOrEqual(3);
  });

  it('should execute /logout and report cleared status', async () => {
    const result = await logoutCommand.execute(['all'], {
      cwd: tempDir,
      session: {} as any,
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('auth.json');
  });

  it('should execute /logout for a specific unconfigured provider', async () => {
    const result = await logoutCommand.execute(['openrouter'], {
      cwd: tempDir,
      session: {} as any,
    });

    expect(result.handled).toBe(true);
    expect(result.message).toContain('No active credentials');
  });
});
