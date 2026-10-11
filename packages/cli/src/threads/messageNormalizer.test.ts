import { describe, it, expect } from 'bun:test';
import { normalizeModelMessages } from './messageNormalizer.js';

describe('normalizeModelMessages', () => {
  it('normalizes legacy tool-call parts with input to canonical args property', () => {
    const raw = [
      {
        role: 'user',
        content: 'Check the weather',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_weather_1',
            toolName: 'weather',
            input: { city: 'Tokyo' }, // AI SDK v7 style
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_weather_1',
            toolName: 'weather',
            output: 'Sunny, 22°C',
          },
        ],
      },
    ];

    const normalized = normalizeModelMessages(raw);

    expect(normalized.length).toBe(3);
    const assistantMsg = normalized[1];
    expect(assistantMsg.role).toBe('assistant');
    if (Array.isArray(assistantMsg.content)) {
      expect(assistantMsg.content[0].type).toBe('tool-call');
      expect((assistantMsg.content[0] as any).args).toEqual({ city: 'Tokyo' });
    }

    const toolMsg = normalized[2];
    expect(toolMsg.role).toBe('tool');
    if (Array.isArray(toolMsg.content)) {
      expect(toolMsg.content[0].result).toBe('Sunny, 22°C');
    }
  });

  it('preserves canonical args and reasoning signature', () => {
    const raw = [
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'Thinking deeply...',
            signature: 'sig_123',
          },
          {
            type: 'tool-call',
            toolCallId: 'call_bash_1',
            toolName: 'bash',
            args: { command: 'ls -la', tagline: 'Listing directory' },
          },
        ],
      },
    ];

    const normalized = normalizeModelMessages(raw);
    expect(normalized.length).toBe(1);
    const content = normalized[0].content as any[];
    expect(content[0].signature).toBe('sig_123');
    expect(content[1].args.command).toBe('ls -la');
  });
});
