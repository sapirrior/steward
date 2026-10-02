import { describe, it, expect } from 'bun:test';
import {
  grokProvider,
  mistralProvider,
  githubCopilotProvider,
  builtinProviders,
} from '../src/index.js';
import { getCopilotBaseUrl, COPILOT_HEADERS } from '../src/providers/github-copilot.js';

describe('new providers (Grok, Mistral, GitHub Copilot)', () => {
  it('instantiates Grok provider correctly', () => {
    const p = grokProvider();
    expect(p.id).toBe('grok');
    expect(p.name).toBe('xAI (Grok)');
    expect(p.baseUrl).toBe('https://api.x.ai/v1');
    expect(p.defaultModelId).toBe('grok-2-latest');
    expect(p.envVars).toContain('XAI_API_KEY');
    expect(p.authScheme).toBe('bearer');
    expect(p.streams['openai-completions']).toBeDefined();
  });

  it('instantiates Mistral provider correctly', () => {
    const p = mistralProvider();
    expect(p.id).toBe('mistral');
    expect(p.name).toBe('Mistral AI');
    expect(p.baseUrl).toBe('https://api.mistral.ai/v1');
    expect(p.defaultModelId).toBe('mistral-large-latest');
    expect(p.envVars).toContain('MISTRAL_API_KEY');
    expect(p.authScheme).toBe('bearer');
    expect(p.streams['openai-completions']).toBeDefined();
  });

  it('instantiates GitHub Copilot provider and prepares dynamic endpoint', () => {
    const p = githubCopilotProvider();
    expect(p.id).toBe('github-copilot');
    expect(p.defaultModelId).toBe('gpt-4o');
    expect(p.authScheme).toBe('bearer');
    expect(p.streams['openai-completions']).toBeDefined();

    // Test default base URL when token has no proxy-ep
    const prepDefault = p.prepare?.(
      {} as any,
      {} as any,
      { apiKey: 'simple-token' },
    );
    expect(prepDefault?.baseUrl).toBe('https://api.individual.githubcopilot.com');
    expect(prepDefault?.headers?.['User-Agent']).toBe(COPILOT_HEADERS['User-Agent']);

    // Test dynamic base URL resolution from proxy-ep
    const proxyToken = 'tid=123;proxy-ep=proxy.business.githubcopilot.com;exp=456';
    const prepDynamic = p.prepare?.(
      {} as any,
      {} as any,
      { apiKey: proxyToken },
    );
    expect(prepDynamic?.baseUrl).toBe('https://api.business.githubcopilot.com');
  });

  it('registers all 7 providers in builtinProviders', () => {
    const all = builtinProviders();
    const ids = all.map((p) => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('grok');
    expect(ids).toContain('mistral');
    expect(ids).toContain('github-copilot');
  });
});
