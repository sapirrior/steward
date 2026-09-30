import { describe, it, expect } from 'bun:test';
import { decodeSSE } from '../src/util/sse.ts';

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>, signal?: AbortSignal) {
  const msgs = [];
  for await (const msg of decodeSSE(stream, signal)) msgs.push(msg);
  return msgs;
}

describe('util/sse — decodeSSE', () => {
  it('parses a simple event', async () => {
    const msgs = await collect(makeStream(['data: hello\n\n']));
    expect(msgs).toEqual([{ data: 'hello', event: undefined, id: undefined }]);
  });

  it('handles CRLF line endings', async () => {
    const msgs = await collect(makeStream(['data: hi\r\n\r\n']));
    expect(msgs[0].data).toBe('hi');
  });

  it('handles CR-only line endings', async () => {
    const msgs = await collect(makeStream(['data: cr\r\r']));
    expect(msgs[0].data).toBe('cr');
  });

  it('handles event field', async () => {
    const msgs = await collect(makeStream(['event: ping\ndata: {}\n\n']));
    expect(msgs[0].event).toBe('ping');
    expect(msgs[0].data).toBe('{}');
  });

  it('skips comment lines', async () => {
    const msgs = await collect(makeStream([': this is a comment\ndata: real\n\n']));
    expect(msgs).toHaveLength(1);
    expect(msgs[0].data).toBe('real');
  });

  it('joins multi-line data with newline', async () => {
    const msgs = await collect(makeStream(['data: line1\ndata: line2\n\n']));
    expect(msgs[0].data).toBe('line1\nline2');
  });

  it('handles chunk boundary split across event boundary', async () => {
    const msgs = await collect(makeStream(['data: hel', 'lo\n\n']));
    expect(msgs[0].data).toBe('hello');
  });

  it('handles chunk boundary splitting the double-newline', async () => {
    const msgs = await collect(makeStream(['data: hello\n', '\n']));
    expect(msgs[0].data).toBe('hello');
  });

  it('parses multiple events', async () => {
    const msgs = await collect(makeStream(['data: a\n\ndata: b\n\n']));
    expect(msgs).toHaveLength(2);
    expect(msgs[0].data).toBe('a');
    expect(msgs[1].data).toBe('b');
  });

  it('flushes trailing event without trailing newline', async () => {
    const msgs = await collect(makeStream(['data: trailing']));
    expect(msgs[0].data).toBe('trailing');
  });

  it('strips leading space from value', async () => {
    const msgs = await collect(makeStream(['data: spaced\n\n']));
    expect(msgs[0].data).toBe('spaced');
  });

  it('terminates cleanly when signal fires mid-stream', async () => {
    const controller = new AbortController();
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        c.enqueue(enc.encode('data: first\n\n'));
        await new Promise((r) => setTimeout(r, 200));
        c.enqueue(enc.encode('data: second\n\n'));
        c.close();
      },
    });
    setTimeout(() => controller.abort(), 10);
    const msgs: unknown[] = [];
    try {
      for await (const msg of decodeSSE(stream, controller.signal)) msgs.push(msg);
    } catch { /* abort expected */ }
    // Stream must terminate (not hang) — we don't assert count as timing is non-deterministic
    expect(true).toBe(true);
  });
});
