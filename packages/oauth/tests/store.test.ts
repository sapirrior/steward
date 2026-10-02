import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAuthStore,
  writeAuthStore,
  getStoredToken,
  saveStoredToken,
  deleteStoredToken,
  ensureAuthDir,
  AuthStorageError,
} from '../src/store.js';
import type { TokenRecord } from '../src/types.js';

describe('@steward/oauth store', () => {
  let tempDir: string;
  let authFile: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'steward-oauth-test-'));
    authFile = join(tempDir, 'auth.json');
    originalEnv = process.env.STEWARD_AUTH_FILE;
    process.env.STEWARD_AUTH_FILE = authFile;
  });

  afterEach(async () => {
    if (originalEnv !== undefined) {
      process.env.STEWARD_AUTH_FILE = originalEnv;
    } else {
      delete process.env.STEWARD_AUTH_FILE;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty object when auth file does not exist', async () => {
    const store = await readAuthStore();
    expect(store).toEqual({});
  });

  it('creates directory and saves token atomically', async () => {
    const token: TokenRecord = {
      type: 'oauth',
      access: 'sk-ant-test-token-123',
      refresh: 'sk-ant-refresh-456',
      expires: Date.now() + 3600_000,
      account: 'test@example.com',
    };

    await saveStoredToken('anthropic', token);
    const retrieved = await getStoredToken('anthropic');
    expect(retrieved).toEqual(token);

    const store = await readAuthStore();
    expect(store.anthropic).toEqual(token);
  });

  it('updates token for one provider without affecting others', async () => {
    const tokenA: TokenRecord = {
      type: 'oauth',
      access: 'token-a',
    };
    const tokenB: TokenRecord = {
      type: 'oauth',
      access: 'token-b',
    };

    await saveStoredToken('anthropic', tokenA);
    await saveStoredToken('openrouter', tokenB);

    expect(await getStoredToken('anthropic')).toEqual(tokenA);
    expect(await getStoredToken('openrouter')).toEqual(tokenB);

    const tokenAUpdated: TokenRecord = {
      type: 'oauth',
      access: 'token-a-updated',
    };
    await saveStoredToken('anthropic', tokenAUpdated);

    expect(await getStoredToken('anthropic')).toEqual(tokenAUpdated);
    expect(await getStoredToken('openrouter')).toEqual(tokenB);
  });

  it('deletes token correctly', async () => {
    await saveStoredToken('anthropic', { type: 'oauth', access: 'tok' });
    expect(await deleteStoredToken('anthropic')).toBe(true);
    expect(await getStoredToken('anthropic')).toBeNull();
    expect(await deleteStoredToken('anthropic')).toBe(false);
  });

  it('handles corrupted JSON safely with controlled AuthStorageError', async () => {
    await ensureAuthDir();
    await writeFile(authFile, 'INVALID_JSON_CONTENT{', 'utf-8');

    await expect(readAuthStore()).rejects.toThrow(AuthStorageError);
    await expect(readAuthStore()).rejects.toThrow(/corrupted or malformed/);
  });

  it('handles concurrent writes without data loss', async () => {
    const providers = Array.from({ length: 15 }, (_, i) => `provider-${i}`);

    await Promise.all(
      providers.map((p, idx) =>
        saveStoredToken(p, {
          type: 'oauth',
          access: `access-${idx}`,
          account: `user-${idx}@example.com`,
        }),
      ),
    );

    const store = await readAuthStore();
    for (let i = 0; i < providers.length; i++) {
      expect(store[`provider-${i}`]?.access).toBe(`access-${i}`);
    }
  });
});
