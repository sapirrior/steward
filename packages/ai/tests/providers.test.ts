import { describe, it, expect } from 'bun:test';
import {
  anthropicProvider,
  openAIProvider,
  googleProvider,
  openRouterProvider,
  openAICompatibleProvider,
  builtinProviders,
} from '../src/providers/index.ts';
import { resolveApiKey } from '../src/auth.ts';

describe('providers/index — builtinProviders', () => {
  it('instantiates all 7 built-in providers with valid IDs', () => {
    const providers = builtinProviders();
    expect(providers).toHaveLength(7);

    const ids = providers.map((p) => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('grok');
    expect(ids).toContain('mistral');
    expect(ids).toContain('github-copilot');
  });


  it('declares protocol streams for each provider', () => {
    const anthropic = anthropicProvider();
    expect(anthropic.streams['anthropic-messages']).toBeDefined();

    const openai = openAIProvider();
    expect(openai.streams['openai-responses']).toBeDefined();
    expect(openai.streams['openai-completions']).toBeDefined();

    const google = googleProvider();
    expect(google.streams['google-generative-ai']).toBeDefined();

    const openrouter = openRouterProvider();
    expect(openrouter.streams['openai-completions']).toBeDefined();
  });

  it('openAICompatibleProvider supports keyless resolution for local models', async () => {
    const local = openAICompatibleProvider({
      id: 'ollama',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      keyless: true,
    });

    const resolved = await resolveApiKey(local);
    expect(resolved).toBeDefined();
    expect(resolved.apiKey).toBe('');
    expect(resolved.source).toBe('keyless');
    expect(resolved.baseUrl).toBe('http://localhost:11434/v1');
  });
});
