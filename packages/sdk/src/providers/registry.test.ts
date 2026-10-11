import { describe, expect, it } from 'bun:test';
import { ProviderRegistry } from './registry.js';
import { StewardSDKError } from '../errors.js';

describe('ProviderRegistry', () => {
  it('registers all 11 default providers on construction', () => {
    const registry = new ProviderRegistry();
    const ids = registry.getRegisteredProviderIds();
    expect(ids).toEqual([
      'anthropic',
      'custom',
      'deepseek',
      'github-copilot',
      'google',
      'groq',
      'mistral',
      'ollama',
      'openai',
      'openrouter',
      'xai',
    ]);
  });

  it('resolves anthropic with valid key without throwing', () => {
    const registry = new ProviderRegistry();
    const model = registry.resolve('anthropic', 'claude-sonnet-4-5', {
      apiKey: 'test-key-123',
    });
    expect(model).toBeDefined();
    expect(model.modelId).toBe('claude-sonnet-4-5');
  });

  it('throws auth error if apiKey is missing for a key-required provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve('openai', 'gpt-4o')).toThrow(StewardSDKError);
    try {
      registry.resolve('openai', 'gpt-4o');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('auth');
      expect(err.retryable).toBe(false);
      expect(err.provider).toBe('openai');
    }
  });

  it('resolves aliases cleanly (gemini -> google, copilot -> github-copilot)', () => {
    const registry = new ProviderRegistry();
    const geminiModel = registry.resolve('gemini', 'gemini-2.5-flash', {
      apiKey: 'test-key',
    });
    expect(geminiModel).toBeDefined();

    const copilotModel = registry.resolve('copilot', 'gpt-4o', {
      apiKey: 'test-token',
    });
    expect(copilotModel).toBeDefined();
  });

  it('resolves ollama with default local baseURL', () => {
    const registry = new ProviderRegistry();
    const model = registry.resolve('ollama', 'llama3');
    expect(model).toBeDefined();
  });

  it('requires baseURL for custom provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve('custom', 'my-model')).toThrow(StewardSDKError);
    try {
      registry.resolve('custom', 'my-model');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('invalid-input');
      expect(err.provider).toBe('custom');
    }

    const validCustom = registry.resolve('custom', 'my-model', {
      baseURL: 'http://localhost:8000/v1',
    });
    expect(validCustom).toBeDefined();
  });

  it('throws invalid-input on unknown provider', () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve('non-existent', 'model-1')).toThrow(StewardSDKError);
    try {
      registry.resolve('non-existent', 'model-1');
    } catch (e) {
      const err = e as StewardSDKError;
      expect(err.kind).toBe('invalid-input');
      expect(err.message).toContain('Unknown provider');
    }
  });

  it('prevents registering duplicate provider or alias', () => {
    expect(
      () =>
        new ProviderRegistry([
          {
            id: 'openai',
            createModel: () => ({}) as any,
          },
        ]),
    ).toThrow(StewardSDKError);

    expect(
      () =>
        new ProviderRegistry([
          {
            id: 'my-provider',
            aliases: ['gemini'],
            createModel: () => ({}) as any,
          },
        ]),
    ).toThrow(StewardSDKError);
  });
});
