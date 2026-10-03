import { describe, it, expect, mock } from 'bun:test';
import { discoverProviderModels, NON_CHAT_MODEL_REGEX } from '../src/models/discovery.js';
import { fetchModelMetadata } from '../src/models/models-dev.js';
import { githubCopilotProvider, openAIProvider } from '../src/provider/index.js';

describe('models/discovery — discoverProviderModels', () => {
  it('filters non-chat and tool-incompatible models', () => {
    expect(NON_CHAT_MODEL_REGEX.test('text-embedding-3-small')).toBe(true);
    expect(NON_CHAT_MODEL_REGEX.test('whisper-1')).toBe(true);
    expect(NON_CHAT_MODEL_REGEX.test('dall-e-3')).toBe(true);
    expect(NON_CHAT_MODEL_REGEX.test('tts-1')).toBe(true);
    expect(NON_CHAT_MODEL_REGEX.test('gpt-4o')).toBe(false);
    expect(NON_CHAT_MODEL_REGEX.test('claude-3-5-sonnet-20241022')).toBe(false);
  });

  it('discovers GitHub Copilot models dynamically from /models endpoint', async () => {
    const mockFetch = mock(async () => {
      return new Response(
        JSON.stringify({
          data: [
            { id: 'gpt-4o', capabilities: { supports: { tool_calls: true } } },
            { id: 'claude-3.5-sonnet', capabilities: { supports: { tool_calls: true } } },
            { id: 'text-embedding-3-small', capabilities: { supports: { tool_calls: false } } },
          ],
        }),
        { status: 200 },
      );
    });

    const copilot = githubCopilotProvider();
    const models = await discoverProviderModels(
      copilot,
      { apiKey: 'mock-token' },
      mockFetch as any,
    );

    expect(models.length).toBe(2);
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'claude-3.5-sonnet']);
    expect(models[0].provider).toBe('github-copilot');
  });

  it('fetches on-demand metadata for a specific model ID', async () => {
    const mockFetch = mock(async () => {
      return new Response(
        JSON.stringify({
          openai: {
            models: {
              'gpt-4o': {
                id: 'gpt-4o',
                name: 'GPT-4o',
                limit: { context: 128000, output: 16384 },
                cost: { input: 2.5, output: 10 },
              },
            },
          },
        }),
        { status: 200 },
      );
    });

    const meta = await fetchModelMetadata('gpt-4o', { fetchFn: mockFetch as any, force: true });
    expect(meta).toBeDefined();
    expect(meta?.contextWindow).toBe(128000);
    expect(meta?.maxOutputTokens).toBe(16384);
    expect(meta?.cost?.input).toBe(2.5);
  });
});
