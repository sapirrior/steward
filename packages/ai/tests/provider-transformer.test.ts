/**
 * Provider + transformer smoke tests.
 * Validates the new SDK-backed provider structure and transformer pipeline.
 */
import { describe, it, expect } from 'bun:test';
import { builtinProviders, openAICompatibleProvider } from '../src/index.js';
import { getNamespaceConfig } from '../src/transformer/config.js';
import { normalizeUsage } from '../src/transformer/usage.js';
import { normalizeTools } from '../src/transformer/tools.js';
import { MessageBuilder } from '../src/transformer/message-builder.js';

describe('provider definitions', () => {
  it('all 10 built-in providers have languageModel factory and required fields', () => {
    const providers = builtinProviders();
    const requiredIds = [
      'anthropic',
      'openai',
      'google',
      'mistral',
      'grok',
      'deepseek',
      'groq',
      'openrouter',
      'ollama',
      'github-copilot',
    ];
    for (const id of requiredIds) {
      const p = providers.find((p) => p.id === id);
      expect(p, `missing provider: ${id}`).toBeDefined();
      expect(typeof p!.languageModel, `${id} missing languageModel`).toBe('function');
      expect(p!.namespace, `${id} missing namespace`).toBeTruthy();
    }
  });

  it('openAICompatibleProvider creates provider with languageModel', () => {
    const p = openAICompatibleProvider({
      id: 'my-llm',
      name: 'My LLM',
      baseUrl: 'http://localhost:8080/v1',
      keyless: true,
    });
    expect(p.id).toBe('my-llm');
    expect(typeof p.languageModel).toBe('function');
    expect(p.keyless).toBe(true);
  });
});

describe('transformer — usage normalizer', () => {
  it('prefers noCacheTokens over inputTokens for canonical input (D-G fix)', () => {
    const config = getNamespaceConfig('anthropic');
    const usage = normalizeUsage(
      {
        inputTokens: 1000,
        inputTokenDetails: { noCacheTokens: 800, cacheReadTokens: 200, cacheWriteTokens: 0 },
        outputTokens: 50,
        outputTokenDetails: { textTokens: 50, reasoningTokens: 0 },
        totalTokens: 1050,
      },
      config,
    );
    expect(usage.input).toBe(800); // noCacheTokens, not 1000
    expect(usage.cacheRead).toBe(200);
    expect(usage.output).toBe(50);
  });
});

describe('transformer — message builder', () => {
  it('captures reasoning signature (D-A fix)', () => {
    const builder = new MessageBuilder();
    builder.appendReasoning('thought...', 'sig-abc123');
    builder.appendText('answer');
    const msg = builder.build();
    const thinking = msg.content.find((b) => b.type === 'thinking') as any;
    expect(thinking?.thinkingSignature).toBe('sig-abc123');
    const text = msg.content.find((b) => b.type === 'text') as any;
    expect(text?.text).toBe('answer');
  });

  it('attaches meta to built message (D-B fix)', () => {
    const builder = new MessageBuilder();
    builder.appendText('hello');
    const meta = {
      modelId: 'claude-opus-4-5',
      provider: 'anthropic' as const,
      protocol: 'anthropic-messages' as const,
    };
    const msg = builder.build(meta);
    expect(msg.meta?.modelId).toBe('claude-opus-4-5');
  });
});

describe('transformer — tools', () => {
  it('converts ToolSpec array to AI SDK ToolSet', () => {
    const tools = normalizeTools([
      {
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
      },
    ]);
    expect(tools).toBeDefined();
    expect(typeof tools!['read_file']).toBe('object');
  });
});
