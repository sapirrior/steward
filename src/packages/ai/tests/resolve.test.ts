import { describe, it, expect } from 'bun:test';
import { resolveAuth } from '../src/auth/resolve.ts';
import { InMemoryCredentialStore } from '../src/auth/memory-store.ts';
import type { AuthContext, OAuthCredential, ProviderAuth } from '../src/auth/types.js';

describe('auth/resolve — resolveAuth', () => {
  it('stored api-key credential wins over environment variable', async () => {
    const store = new InMemoryCredentialStore();
    await store.modify('custom', async () => ({ type: 'api-key', key: 'stored-key' }));

    const context: AuthContext = {
      env: () => 'env-key',
      fileExists: () => false,
    };

    const provider = {
      id: 'custom',
      auth: {
        apiKey: {
          envVars: ['CUSTOM_KEY'],
          resolve: (cred) => (cred.type === 'api-key' ? { apiKey: cred.key, source: 'stored-credential' } : undefined),
        },
      },
    };

    const res = await resolveAuth(provider, store, context);
    expect(res.apiKey).toBe('stored-key');
    expect(res.source).toBe('stored-credential');
  });

  it('uses env var only when nothing is stored', async () => {
    const store = new InMemoryCredentialStore();
    const context: AuthContext = {
      env: (v) => (v === 'CUSTOM_KEY' ? 'env-key-123' : undefined),
      fileExists: () => false,
    };

    const provider = {
      id: 'custom',
      auth: {
        apiKey: {
          envVars: ['CUSTOM_KEY'],
          resolve: () => undefined,
        },
      },
    };

    const res = await resolveAuth(provider, store, context);
    expect(res.apiKey).toBe('env-key-123');
    expect(res.source).toBe('env:CUSTOM_KEY');
  });

  it('performs double-checked OAuth refresh only when expired/expiring', async () => {
    const store = new InMemoryCredentialStore();
    let refreshCount = 0;

    const initialCred: OAuthCredential = {
      type: 'oauth',
      accessToken: 'old-access-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 60_000, // Expires in 1 min (< 5 min default window)
    };
    await store.modify('oauth-prov', async () => initialCred);

    const provider = {
      id: 'oauth-prov',
      auth: {
        oauth: {
          name: 'OAuth Provider',
          login: async () => initialCred,
          refresh: async () => {
            refreshCount++;
            return {
              type: 'oauth' as const,
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
              expiresAt: Date.now() + 3600_000, // 1 hr
            };
          },
          toAuth: (c: OAuthCredential) => ({ apiKey: c.accessToken, source: 'OAuth' }),
        },
      },
    };

    // Run 5 concurrent resolve calls
    const results = await Promise.all([
      resolveAuth(provider, store),
      resolveAuth(provider, store),
      resolveAuth(provider, store),
      resolveAuth(provider, store),
      resolveAuth(provider, store),
    ]);

    expect(refreshCount).toBe(1); // Only 1 refresh executed!
    for (const r of results) {
      expect(r.apiKey).toBe('new-access-token');
    }

    const saved = await store.read('oauth-prov');
    expect((saved as OAuthCredential).accessToken).toBe('new-access-token');
  });

  it('modify fn returning undefined leaves credential intact', async () => {
    const store = new InMemoryCredentialStore();
    await store.modify('test-p', async () => ({ type: 'api-key', key: 'initial' }));

    const res = await store.modify('test-p', async () => undefined);
    expect(res).toBeUndefined();

    const current = await store.read('test-p');
    expect(current).toEqual({ type: 'api-key', key: 'initial' });
  });
});
