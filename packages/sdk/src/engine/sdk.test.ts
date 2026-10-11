import { describe, expect, it } from 'bun:test';
import { createStewardSDK } from './sdk.js';
import { MockLanguageModelV4 } from 'ai/test';
import type { ModelMessage } from 'ai';

function createMockTextModel(text: string) {
  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: 't1' });
          controller.enqueue({ type: 'text-delta', id: 't1', delta: text });
          controller.enqueue({ type: 'text-end', id: 't1' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: {
              inputTokens: { total: 10 },
              outputTokens: { total: 5 },
            },
          });
          controller.close();
        },
      }),
    }),
  });
}

describe('StewardSDK stream engine', () => {
  it('streams text deltas and emits single finish event with responseMessages', async () => {
    const mockModel = createMockTextModel('Hello from Steward SDK!');

    const sdk = createStewardSDK({
      additionalProviders: [
        {
          id: 'mock-provider',
          createModel: () => mockModel,
        },
      ],
    });

    const events = [];
    for await (const event of sdk.stream({
      model: 'mock-provider/test-model',
      messages: [],
      message: 'Hello',
    })) {
      events.push(event);
    }

    expect(events.length).toBeGreaterThan(0);
    const deltas = events.filter((e) => e.type === 'text-delta');
    expect(deltas.length).toBe(1);
    expect((deltas[0] as any).text).toBe('Hello from Steward SDK!');

    const finish = events.find((e) => e.type === 'finish');
    expect(finish).toBeDefined();
    expect((finish as any).finishReason).toBe('stop');
    expect((finish as any).responseMessages).toBeDefined();
    expect(Array.isArray((finish as any).responseMessages)).toBe(true);
    expect((finish as any).responseMessages.length).toBe(1);
    expect((finish as any).steps).toBe(1);
  });

  it('handles pre-aborted signal by emitting aborted event', async () => {
    const sdk = createStewardSDK();
    const ac = new AbortController();
    ac.abort();

    const events = [];
    for await (const event of sdk.stream({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [],
      message: 'Hello',
      signal: ac.signal,
    })) {
      events.push(event);
    }

    expect(events.length).toBe(1);
    expect(events[0].type).toBe('aborted');
  });

  it('preserves input messages immutability', async () => {
    const mockModel = createMockTextModel('ok');

    const sdk = createStewardSDK({
      additionalProviders: [
        {
          id: 'test-mock',
          createModel: () => mockModel,
        },
      ],
    });

    const priorHistory: ModelMessage[] = [
      { role: 'user', content: 'prior turn' },
      { role: 'assistant', content: 'prior reply' },
    ];
    Object.freeze(priorHistory);

    const prompt = 'current prompt';

    for await (const _ of sdk.stream({
      model: 'test-mock/model',
      messages: priorHistory,
      message: prompt,
    })) {
      // consume
    }

    expect(priorHistory.length).toBe(2);
    expect(priorHistory[0].content).toBe('prior turn');
  });
});
