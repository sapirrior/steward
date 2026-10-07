import { describe, expect, it, mock } from 'bun:test';
import { createModels } from './client.js';
import { parseModelRef, formatModelRef } from './ref.js';
import { ModelsError } from './types.js';

const SAMPLE_PAYLOAD = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: {
      'claude-3-5-sonnet-20241022': {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        reasoning: false,
        tool_call: true,
        modalities: { input: ['text', 'image'], output: ['text'] },
        limit: { context: 200000, output: 8192 },
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
      },
      'claude-3-7-sonnet-20250219': {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        reasoning: true,
        tool_call: true,
        modalities: { input: ['text', 'image'], output: ['text'] },
        limit: { context: 200000, output: 64000 },
        cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
      },
      'bad-model': null, // malformed entry to skip
    },
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: {
      'gpt-4o': {
        id: 'gpt-4o',
        name: 'GPT-4o',
        reasoning: false,
        tool_call: true,
        modalities: { input: ['text', 'image'], output: ['text'] },
        limit: { context: 128000, output: 16384 },
        cost: { input: 2.5, output: 10 },
      },
      'dall-e-3': {
        id: 'dall-e-3',
        name: 'DALL-E 3',
        modalities: { input: ['text'], output: ['image'] }, // not textCapable
      },
    },
  },
};

describe('parseModelRef and formatModelRef', () => {
  it('parses standard provider/modelId', () => {
    const parsed = parseModelRef('anthropic/claude-3-5-sonnet-20241022');
    expect(parsed).toEqual({
      provider: 'anthropic',
      modelId: 'claude-3-5-sonnet-20241022',
    });
    expect(formatModelRef(parsed!)).toBe('anthropic/claude-3-5-sonnet-20241022');
  });

  it('handles multi-slash OpenRouter IDs by splitting only on the first slash', () => {
    const parsed = parseModelRef('openrouter/anthropic/claude-sonnet-4.5');
    expect(parsed).toEqual({
      provider: 'openrouter',
      modelId: 'anthropic/claude-sonnet-4.5',
    });
    expect(formatModelRef(parsed!)).toBe('openrouter/anthropic/claude-sonnet-4.5');
  });

  it('preserves modelId case while trimming whitespace', () => {
    const parsed = parseModelRef('  openai  /  GPT-4o-Mini  ');
    expect(parsed).toEqual({
      provider: 'openai',
      modelId: 'GPT-4o-Mini',
    });
  });

  it('returns undefined for invalid inputs without slash or empty components', () => {
    expect(parseModelRef('')).toBeUndefined();
    expect(parseModelRef('claude-3-5-sonnet')).toBeUndefined();
    expect(parseModelRef('/claude-3-5-sonnet')).toBeUndefined();
    expect(parseModelRef('anthropic/')).toBeUndefined();
    expect(parseModelRef('  /  ')).toBeUndefined();
  });
});

describe('createModels', () => {
  it('parses models metadata and retrieves by provider and modelId', async () => {
    const mockFetch = mock(async () => {
      return new Response(JSON.stringify(SAMPLE_PAYLOAD), { status: 200 });
    });

    const models = createModels({ fetch: mockFetch as unknown as typeof fetch });
    const model = await models.get('anthropic', 'claude-3-5-sonnet-20241022');

    expect(model).toBeDefined();
    expect(model?.name).toBe('Claude 3.5 Sonnet');
    expect(model?.contextWindow).toBe(200000);
    expect(model?.maxOutputTokens).toBe(8192);
    expect(model?.reasoning).toBe(false);
    expect(model?.toolCall).toBe(true);
    expect(model?.pricing?.input).toBe(3);
    expect(model?.pricing?.output).toBe(15);
    expect(model?.pricing?.cacheRead).toBe(0.3);
    expect(model?.pricing?.cacheWrite).toBe(3.75);

    // Case-insensitive provider lookup
    const upperModel = await models.get('ANTHROPIC', 'claude-3-5-sonnet-20241022');
    expect(upperModel).toBeDefined();
  });

  it('filters by provider and textCapable capability', async () => {
    const mockFetch = mock(async () => {
      return new Response(JSON.stringify(SAMPLE_PAYLOAD), { status: 200 });
    });

    const models = createModels({ fetch: mockFetch as unknown as typeof fetch });

    const allAnthropic = await models.list({ provider: 'anthropic' });
    expect(allAnthropic.length).toBe(2);

    const openAiTextCapable = await models.list({ provider: 'openai', textCapable: true });
    expect(openAiTextCapable.length).toBe(1);
    expect(openAiTextCapable[0]?.id).toBe('gpt-4o');

    const allTextCapable = await models.list({ textCapable: true });
    expect(allTextCapable.length).toBe(3); // 2 Anthropic + 1 OpenAI (DALL-E omitted)
  });

  it('deduplicates concurrent fetches into a single network call', async () => {
    let callCount = 0;
    const mockFetch = mock(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 10));
      return new Response(JSON.stringify(SAMPLE_PAYLOAD), { status: 200 });
    });

    const models = createModels({ fetch: mockFetch as unknown as typeof fetch });

    const [m1, m2, m3] = await Promise.all([
      models.get('anthropic', 'claude-3-5-sonnet-20241022'),
      models.get('anthropic', 'claude-3-7-sonnet-20250219'),
      models.list({ provider: 'openai' }),
    ]);

    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    expect(m3.length).toBe(2);
    expect(callCount).toBe(1);
  });

  it('retries on subsequent call if first load failed', async () => {
    let callCount = 0;
    const mockFetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Network timeout');
      }
      return new Response(JSON.stringify(SAMPLE_PAYLOAD), { status: 200 });
    });

    const models = createModels({ fetch: mockFetch as unknown as typeof fetch });

    await expect(models.get('anthropic', 'claude-3-5-sonnet-20241022')).rejects.toThrow(
      /Network timeout/,
    );

    // Second call should retry and succeed
    const model = await models.get('anthropic', 'claude-3-5-sonnet-20241022');
    expect(model).toBeDefined();
    expect(callCount).toBe(2);
  });

  it('handles HTTP and malformed JSON errors gracefully', async () => {
    const httpErrorFetch = mock(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    });
    const modelsHttp = createModels({ fetch: httpErrorFetch as unknown as typeof fetch });
    await expect(modelsHttp.get('anthropic', 'x')).rejects.toMatchObject({
      kind: 'http',
      status: 404,
    });

    const malformedFetch = mock(async () => {
      return new Response('invalid json', { status: 200 });
    });
    const modelsMalformed = createModels({ fetch: malformedFetch as unknown as typeof fetch });
    await expect(modelsMalformed.get('anthropic', 'x')).rejects.toMatchObject({
      kind: 'malformed',
    });
  });

  it('refreshes cache on refresh()', async () => {
    let callCount = 0;
    const mockFetch = mock(async () => {
      callCount++;
      return new Response(JSON.stringify(SAMPLE_PAYLOAD), { status: 200 });
    });

    const models = createModels({ fetch: mockFetch as unknown as typeof fetch });
    await models.get('anthropic', 'claude-3-5-sonnet-20241022');
    expect(callCount).toBe(1);

    await models.refresh();
    await models.get('anthropic', 'claude-3-5-sonnet-20241022');
    expect(callCount).toBe(2);
  });
});
