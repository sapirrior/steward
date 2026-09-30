import { describe, it, expect } from 'bun:test';
import { AssistantMessageStream } from '../src/event-stream.ts';
import { AIError } from '../src/errors.ts';
import type { InferenceEvent } from '../src/types.ts';

describe('event-stream — AssistantMessageStream', () => {
  it('collects text-delta events and resolves result()', async () => {
    const stream = new AssistantMessageStream();

    stream.push({ type: 'text-delta', delta: 'Hello' });
    stream.push({ type: 'text-delta', delta: ' world' });
    stream.push({
      type: 'done',
      message: { role: 'assistant', content: [] },
      usage: { input: 10, output: 5 },
      finishReason: 'stop',
    });

    const result = await stream.result();
    expect(result.finishReason).toBe('stop');
    expect(result.error).toBeUndefined();

    const textBlock = result.message.content.find((b) => b.type === 'text');
    expect(textBlock).toBeDefined();
    if (textBlock?.type === 'text') expect(textBlock.text).toBe('Hello world');
  });

  it('result() resolves with finishReason error on error event — never rejects', async () => {
    const stream = new AssistantMessageStream();
    const err = new AIError('bad request', { code: 'invalid-request', status: 400 });

    stream.push({ type: 'text-delta', delta: 'partial' });
    stream.push({ type: 'error', error: err });

    const result = await stream.result();
    expect(result.finishReason).toBe('error');
    expect(result.error).toBe(err);
    // Partial content preserved
    const textBlock = result.message.content.find((b) => b.type === 'text');
    expect(textBlock).toBeDefined();
  });

  it('result() resolves with finishReason aborted when end() called', async () => {
    const stream = new AssistantMessageStream();
    stream.push({ type: 'text-delta', delta: 'partial' });
    stream.end();

    const result = await stream.result();
    expect(result.finishReason).toBe('aborted');
    expect(result.error).toBeUndefined();
  });

  it('emits exactly one terminal event — nothing after done', async () => {
    const stream = new AssistantMessageStream();
    const events: InferenceEvent[] = [];

    const consuming = (async () => {
      for await (const e of stream) events.push(e);
    })();

    stream.push({ type: 'text-delta', delta: 'hi' });
    stream.push({
      type: 'done',
      message: { role: 'assistant', content: [] },
      usage: {},
      finishReason: 'stop',
    });
    // These should be ignored
    stream.push({ type: 'text-delta', delta: 'ignored' });

    await consuming;
    const terminalEvents = events.filter((e) => e.type === 'done' || e.type === 'error');
    expect(terminalEvents).toHaveLength(1);
    expect(events.find((e) => e.type === 'text-delta' && (e as { delta: string }).delta === 'ignored')).toBeUndefined();
  });

  it('is async-iterable and yields events in push order', async () => {
    const stream = new AssistantMessageStream();
    const types: string[] = [];

    const consuming = (async () => {
      for await (const e of stream) types.push(e.type);
    })();

    stream.push({ type: 'reasoning-delta', delta: 'think' });
    stream.push({ type: 'text-delta', delta: 'answer' });
    stream.push({
      type: 'done',
      message: { role: 'assistant', content: [] },
      usage: {},
      finishReason: 'stop',
    });

    await consuming;
    expect(types).toEqual(['reasoning-delta', 'text-delta', 'done']);
  });

  it('preserves tool-call blocks in result message', async () => {
    const stream = new AssistantMessageStream();

    stream.push({ type: 'tool-call-start', id: 'tc1', name: 'search' });
    stream.push({ type: 'tool-call-delta', id: 'tc1', delta: '{"q":' });
    stream.push({ type: 'tool-call-delta', id: 'tc1', delta: '"hello"}' });
    stream.push({ type: 'tool-call-end', toolCall: { type: 'tool-call', id: 'tc1', name: 'search', arguments: { q: 'hello' } } });
    stream.push({
      type: 'done',
      message: { role: 'assistant', content: [] },
      usage: {},
      finishReason: 'tool-use',
    });

    const result = await stream.result();
    expect(result.finishReason).toBe('tool-use');
    const toolBlock = result.message.content.find((b) => b.type === 'tool-call');
    expect(toolBlock).toBeDefined();
    if (toolBlock?.type === 'tool-call') {
      expect(toolBlock.name).toBe('search');
      expect(toolBlock.arguments).toEqual({ q: 'hello' });
    }
  });
});
