import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { login, logout, getToken } from '../src/index.js';
import { getStoredToken, saveStoredToken } from '../src/store.js';
import { refreshGitHubCopilot } from '../src/providers/github-copilot.js';

describe('@steward/oauth providers', () => {
  let tempDir: string;
  let authFile: string;
  let originalEnv: string | undefined;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'steward-provider-test-'));
    authFile = join(tempDir, 'auth.json');
    originalEnv = process.env.STEWARD_AUTH_FILE;
    process.env.STEWARD_AUTH_FILE = authFile;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (originalEnv !== undefined) {
      process.env.STEWARD_AUTH_FILE = originalEnv;
    } else {
      delete process.env.STEWARD_AUTH_FILE;
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('handles unsupported provider cleanly in login', async () => {
    const result = await login('unknown-provider');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported OAuth provider');
  });

  it('performs GitHub Copilot token refresh successfully', async () => {
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('api.github.com/copilot_internal/v2/token')) {
        return new Response(
          JSON.stringify({
            token: 'tid=copilot-refreshed-token;proxy-ep=proxy.individual.githubcopilot.com',
            expires_at: Math.floor(Date.now() / 1000) + 1800,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not Found', { status: 404 });
    }) as any;

    const refreshed = await refreshGitHubCopilot({
      type: 'oauth',
      access: 'old-session-token',
      refresh: 'gho_github_access_token_123',
      expires: Date.now() - 1000,
    });

    expect(refreshed.access).toContain('copilot-refreshed-token');
    expect(refreshed.refresh).toBe('gho_github_access_token_123');
  });

  it('performs login and logout cycle with persistence', async () => {
    await saveStoredToken('openrouter', {
      type: 'oauth',
      access: 'sk-or-v1-testkey123',
      account: 'test@openrouter.ai',
    });

    expect(await getToken('openrouter')).toBe('sk-or-v1-testkey123');

    await logout('openrouter');
    expect(await getToken('openrouter')).toBeNull();
    expect(await getStoredToken('openrouter')).toBeNull();
  });
});
