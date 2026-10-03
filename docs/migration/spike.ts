/**
 * Phase 0 spike: verify streamText + mock model works under Bun.
 * Throwaway — not merged.
 */
import { streamText, stepCountIs } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

const model = new MockLanguageModelV4({
  doStream: async () => ({
    stream: new ReadableStream({
      start(c) {
        c.enqueue({ type: 'stream-start', warnings: [] });
        c.enqueue({ type: 'text-start', id: 'b1' });
        c.enqueue({ type: 'text-delta', id: 'b1', delta: 'Hello ' });
        c.enqueue({ type: 'text-delta', id: 'b1', delta: 'world' });
        c.enqueue({ type: 'text-end', id: 'b1' });
        c.enqueue({
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 },
        });
        c.close();
      },
    }),
  }),
});

const result = streamText({
  model,
  prompt: 'Hello',
  stopWhen: stepCountIs(1),
  maxRetries: 0,
});

const parts: string[] = [];
for await (const part of result.fullStream) {
  parts.push(part.type);
  if (part.type === 'text-delta') {
    process.stdout.write(part.text);
  }
}

process.stdout.write('\n');
console.log('Parts seen:', parts);
const usage = (await result.usage);
console.log('Usage:', usage);
console.log('✅ Spike passed');
