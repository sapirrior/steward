import { describe, it, expect } from 'bun:test';
import { ProviderRegistry, type ModelProvider } from './index.js';
import type { LanguageModel } from 'ai';
import type { ModelRef } from '@steward/models';

describe('ProviderRegistry (Open-Closed Principle)', () => {
  it('registers all 11 default providers on initialization', () => {
    const registry = new ProviderRegistry();
    const providers = registry.getRegisteredProviders();

    expect(providers.length).toBe(11);
    const ids = providers.map((p) => p.id);
    expect(ids).toContain('anthropic');
    expect(ids).toContain('openai');
    expect(ids).toContain('google');
    expect(ids).toContain('openrouter');
    expect(ids).toContain('github-copilot');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('mistral');
    expect(ids).toContain('groq');
    expect(ids).toContain('xai');
    expect(ids).toContain('ollama');
    expect(ids).toContain('custom');
  });

  it('allows registering a custom provider plugin without modifying registry internals (OCP)', async () => {
    const registry = new ProviderRegistry();

    const mockPlugin: ModelProvider = {
      id: 'bedrock',
      displayName: 'Amazon Bedrock',
      canHandle: (ref: ModelRef) => ref.provider === 'bedrock',
      resolveModel: async (ref: ModelRef) => {
        return {
          specificationVersion: 'v4',
          provider: 'bedrock.mock',
          modelId: ref.modelId,
        } as unknown as LanguageModel;
      },
    };

    registry.register(mockPlugin);

    const resolved = await registry.resolve('bedrock/anthropic.claude-3-sonnet');
    expect(resolved.provider.id).toBe('bedrock');
    expect(resolved.ref.modelId).toBe('anthropic.claude-3-sonnet');
    expect((resolved.model as any).modelId).toBe('anthropic.claude-3-sonnet');
  });

  it('resolves anthropic model reference cleanly', async () => {
    const registry = new ProviderRegistry();
    const resolved = await registry.resolve('anthropic/claude-3-7-sonnet-20250219', {
      apiKey: 'test-key',
    });

    expect(resolved.provider.id).toBe('anthropic');
    expect(resolved.ref.provider).toBe('anthropic');
    expect(resolved.ref.modelId).toBe('claude-3-7-sonnet-20250219');
    expect((resolved.model as any).modelId).toBe('claude-3-7-sonnet-20250219');
  });

  it('resolves openai model reference cleanly', async () => {
    const registry = new ProviderRegistry();
    const resolved = await registry.resolve('openai/gpt-4o', {
      apiKey: 'test-key',
    });

    expect(resolved.provider.id).toBe('openai');
    expect((resolved.model as any).modelId).toBe('gpt-4o');
  });

  it('resolves google/gemini provider aliases cleanly', async () => {
    const registry = new ProviderRegistry();
    const resolved = await registry.resolve('google/gemini-2.5-pro', {
      apiKey: 'test-key',
    });

    expect(resolved.provider.id).toBe('google');
    expect((resolved.model as any).modelId).toBe('gemini-2.5-pro');
  });

  it('throws structured error for malformed model string', async () => {
    const registry = new ProviderRegistry();
    await expect(registry.resolve('invalid-no-slash')).rejects.toThrow(
      "Invalid model format 'invalid-no-slash'",
    );
  });

  it('throws structured error for unregistered provider', async () => {
    const registry = new ProviderRegistry();
    await expect(registry.resolve('unknown-prov/model-123')).rejects.toThrow(
      "No provider registered to handle 'unknown-prov'",
    );
  });
});
