import { describe, it, expect, mock } from 'bun:test';
import { createStreamAdapter } from './streamAdapter.js';
import type { AI, InferenceStream, InferenceEvent, InferenceResult } from '@steward/ai';
import type { StreamRequest } from '@steward/agent';

describe('createStreamAdapter', () => {
  it('should adapt AI.stream events and result into ModelStream', async () => {
    const mockEvents: InferenceEvent[] = [
      { type: 'text-delta', delta: 'Hello ' },
      { type: 'text-delta', delta: 'world!' },
      {
        type: 'done',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello world!' }],
        },
        usage: { input: 10, output: 5, total: 15 },
        finishReason: 'stop',
      },
    ];

    const mockResult: InferenceResult = {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello world!' }],
      },
      usage: { input: 10, output: 5, total: 15 },
      finishReason: 'stop',
    };

    const mockInferenceStream: InferenceStream = {
      async *[Symbol.asyncIterator]() {
        for (const ev of mockEvents) {
          yield ev;
        }
      },
      async result() {
        return mockResult;
      },
    };

    const mockAi = {
      stream: mock((_req) => mockInferenceStream),
    } as unknown as AI;

    const streamFn = createStreamAdapter(mockAi, {
      provider: 'google',
      modelId: 'gemini-flash-latest',
      effort: 'medium',
    });

    const streamReq: StreamRequest = {
      messages: [{ role: 'user', content: 'Say hello' }],
      tools: [],
    };

    const modelStream = streamFn(streamReq);

    const receivedEvents = [];
    for await (const ev of modelStream) {
      receivedEvents.push(ev);
    }

    expect(receivedEvents.length).toBe(3);
    expect(receivedEvents[0]).toEqual({ type: 'text-delta', delta: 'Hello ' });
    expect(receivedEvents[1]).toEqual({ type: 'text-delta', delta: 'world!' });

    const result = await modelStream.result();
    expect(result.message.content[0]).toEqual({ type: 'text', text: 'Hello world!' });
    expect(result.usage.total).toBe(15);
  });
});
