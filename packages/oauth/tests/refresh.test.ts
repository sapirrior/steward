import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  saveStoredToken,
  getStoredToken,
} from '../src/store.js';
import {
  registerTokenRefresher,
  getOrRefreshToken,
  EXPIRY_BUFFER_MS,
} from '../src/refresh.js';
import type { TokenRecord } from '../src/types.js';

describe('@steward/oauth refresh', () => {
  let tempDir: string;
  let authFile: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'steward-refresh-test-'));
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

  it('returns valid token without triggering refresher', async () => {
    let refreshCalls = 0;
    registerTokenRefresher('anthropic', async (token) => {
      refreshCalls++;
      return token;
    });

    const validToken: TokenRecord = {
      type: 'oauth',
      access: 'valid-access-token',
      expires: Date.now() + 2 * EXPIRY_BUFFER_MS, // 10 minutes left
    };
    await saveStoredToken('anthropic', validToken);

    const result = await getOrRefreshToken('anthropic');
    expect(result).toBe('valid-access-token');
    expect(refreshCalls).toBe(0);
  });

  it('proactively refreshes expiring token and persists it', async () => {
    let refreshCalls = 0;
    registerTokenRefresher('anthropic', async (token) => {
      refreshCalls++;
      return {
        ...token,
        access: 'new-refreshed-token',
        expires: Date.now() + 3600_000,
      };
    });

    const expiringToken: TokenRecord = {
      type: 'oauth',
      access: 'old-expiring-token',
      refresh: 'refresh-tok',
      expires: Date.now() + 60_000, // 1 minute left (within 5 min buffer)
    };
    await saveStoredToken('anthropic', expiringToken);

    const result = await getOrRefreshToken('anthropic');
    expect(result).toBe('new-refreshed-token');
    expect(refreshCalls).toBe(1);

    const stored = await getStoredToken('anthropic');
    expect(stored?.access).toBe('new-refreshed-token');
  });

  it('coalesces concurrent refresh calls for the same provider', async () => {
    let refreshCalls = 0;
    registerTokenRefresher('openrouter', async (token) => {
      refreshCalls++;
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 30));
      return {
        ...token,
        access: 'coalesced-access-token',
        expires: Date.now() + 3600_000,
      };
    });

    const expiringToken: TokenRecord = {
      type: 'oauth',
      access: 'old-token',
      expires: Date.now() - 1000, // expired
    };
    await saveStoredToken('openrouter', expiringToken);

    const concurrentResults = await Promise.all([
      getOrRefreshToken('openrouter'),
      getOrRefreshToken('openrouter'),
      getOrRefreshToken('openrouter'),
      getOrRefreshToken('openrouter'),
      getOrRefreshToken('openrouter'),
    ]);

    expect(refreshCalls).toBe(1);
    for (const res of concurrentResults) {
      expect(res).toBe('coalesced-access-token');
    }
  });

  it('invalidates provider upon permanent rejection without affecting other providers', async () => {
    registerTokenRefresher('anthropic', async () => {
      const error: any = new Error('Invalid grant');
      error.status = 401;
      throw error;
    });

    await saveStoredToken('anthropic', {
      type: 'oauth',
      access: 'bad-token',
      expires: Date.now() - 1000,
    });
    await saveStoredToken('github-copilot', {
      type: 'oauth',
      access: 'copilot-good-token',
    });

    const anthropicResult = await getOrRefreshToken('anthropic');
    expect(anthropicResult).toBeNull();
    expect(await getStoredToken('anthropic')).toBeNull();

    // Verify other providers remain intact
    expect(await getStoredToken('github-copilot')).toEqual({
      type: 'oauth',
      access: 'copilot-good-token',
    });
  });

  it('returns null when provider is not authenticated', async () => {
    const result = await getOrRefreshToken('unknown-provider');
    expect(result).toBeNull();
  });
});
