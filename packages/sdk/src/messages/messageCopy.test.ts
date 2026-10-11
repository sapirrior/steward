import { describe, expect, it } from 'bun:test';
import { cloneModelMessages, cloneUserContent } from './messageCopy.js';
import type { ModelMessage } from 'ai';

describe('messageCopy immutability', () => {
  it('clones user string content', () => {
    const original = 'Hello world';
    const cloned = cloneUserContent(original);
    expect(cloned).toBe(original);
  });

  it('clones multipart user content without mutating inputs', () => {
    const buffer = new Uint8Array([1, 2, 3]);
    const url = new URL('https://example.com/image.png');
    const original = [
      { type: 'text' as const, text: 'Inspect this' },
      { type: 'image' as const, image: url },
      { type: 'file' as const, data: buffer, mediaType: 'application/octet-stream' },
    ];

    Object.freeze(original);
    const cloned = cloneUserContent(original);
    expect(Array.isArray(cloned)).toBe(true);
    if (Array.isArray(cloned)) {
      expect(cloned).toHaveLength(3);
      // Ensure clones are independent objects
      expect(cloned[0]).not.toBe(original[0]);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    }
  });

  it('deep clones ModelMessage history with assistant and tool calls', () => {
    const history: ModelMessage[] = [
      { role: 'user', content: 'What is the weather?' },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'getWeather',
            args: { city: 'Tokyo' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'getWeather',
            output: { type: 'json', value: { temp: 22 } },
          },
        ],
      },
    ];

    // Freeze history to guarantee no mutations can occur
    Object.freeze(history);
    Object.freeze(history[0]);
    Object.freeze(history[1]);
    Object.freeze(history[2]);

    const cloned = cloneModelMessages(history);
    expect(cloned).toHaveLength(3);
    expect(cloned).not.toBe(history);

    // Verify deep mutation safety on tool call args
    const assistantMsg = cloned[1];
    if (assistantMsg.role === 'assistant' && Array.isArray(assistantMsg.content)) {
      const part = assistantMsg.content[0];
      if (part.type === 'tool-call') {
        (part.args as any).city = 'Kyoto';
      }
    }

    // Original must stay untouched
    const origAssistantMsg = history[1];
    if (origAssistantMsg.role === 'assistant' && Array.isArray(origAssistantMsg.content)) {
      const origPart = origAssistantMsg.content[0];
      if (origPart.type === 'tool-call') {
        expect((origPart.args as any).city).toBe('Tokyo');
      }
    }
  });
});
