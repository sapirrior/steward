import { describe, it, expect } from 'bun:test';
import { resolveApiKey } from '../src/auth.js';
import { anthropicProvider, openAICompatibleProvider } from '../src/provider/index.js';
import { AIError } from '../src/errors.js';

describe('auth — resolveApiKey priority order', () => {
  const anthropic = anthropicProvider();

  it('resolves request.apiKey with highest priority', async () => {
    const auth = await resolveApiKey(
      anthropic,
      {
        apiKeys: { anthropic: 'options-key' },
        env: () => 'env-key',
      },
      'request-key',
    );
    expect(auth.apiKey).toBe('request-key');
    expect(auth.source).toBe('request');
    expect(auth.scheme).toBe('x-api-key');
  });

  it('resolves options.apiKeys when request apiKey is absent', async () => {
    const auth = await resolveApiKey(anthropic, {
      apiKeys: { anthropic: 'options-key' },
      env: () => 'env-key',
    });
    expect(auth.apiKey).toBe('options-key');
    expect(auth.source).toBe('option');
  });

  it('resolves options.getApiKey when apiKeys is absent', async () => {
    const auth = await resolveApiKey(anthropic, {
      getApiKey: async (id) => (id === 'anthropic' ? 'callback-key' : undefined),
      env: () => 'env-key',
    });
    expect(auth.apiKey).toBe('callback-key');
    expect(auth.source).toBe('callback');
  });

  it('resolves env var when callbacks/options are absent', async () => {
    const auth = await resolveApiKey(anthropic, {
      env: (name) => (name === 'ANTHROPIC_API_KEY' ? 'env-key' : undefined),
    });
    expect(auth.apiKey).toBe('env-key');
    expect(auth.source).toBe('env');
  });

  it('resolves keyless provider without key', async () => {
    const ollama = openAICompatibleProvider({
      id: 'ollama',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      keyless: true,
    });
    const auth = await resolveApiKey(ollama, { env: () => undefined });
    expect(auth.apiKey).toBe('');
    expect(auth.source).toBe('keyless');
  });

  it('throws AIError code auth when unconfigured, mentioning env vars', async () => {
    expect(resolveApiKey(anthropic, { env: () => undefined })).rejects.toThrow(AIError);
    try {
      await resolveApiKey(anthropic, { env: () => undefined });
    } catch (err: unknown) {
      expect((err as AIError).code).toBe('auth');
      expect((err as AIError).message).toContain('ANTHROPIC_API_KEY');
    }
  });

  it('createAI resolves dynamically with external token provider callback', async () => {
    const { createAI } = await import('../src/client.ts');

    // External token source (mocking an external OAuth store)
    const externalTokens: Record<string, string | null> = {
      anthropic: 'external-oauth-token-abc',
      openai: null,
    };

    const ai = createAI({
      getApiKey: async (providerId) => externalTokens[providerId] ?? undefined,
      env: () => undefined, // No env vars
    });

    expect(await ai.isConfigured('anthropic')).toBe(true);
    expect(await ai.isConfigured('openai')).toBe(false);

    const status = await ai.authStatus('anthropic');
    expect(status.configured).toBe(true);
    expect(status.source).toBe('callback');
  });
});
