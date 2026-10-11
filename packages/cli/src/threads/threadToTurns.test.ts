import { describe, it, expect } from 'bun:test';
import { reconstructTurnsFromMessages } from './threadToTurns.js';
import type { ModelMessage } from '@steward/threads';

describe('reconstructTurnsFromMessages', () => {
  it('converts simple user and assistant messages into CompletedTurn', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];

    const turns = reconstructTurnsFromMessages(messages);
    expect(turns.length).toBe(1);
    expect(turns[0]?.userPrompt).toBe('hello');
    expect(turns[0]?.text).toBe('hi there');
    expect(turns[0]?.status).toBe('finished');
  });

  it('reconstructs reasoning and tool calls', () => {
    const messages: ModelMessage[] = [
      { role: 'user', content: 'run bash' },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'thinking...' },
          { type: 'tool-call', toolCallId: 'tc1', toolName: 'bash', args: { command: 'ls' } },
          { type: 'text', text: 'Here are the files' },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'tc1',
            toolName: 'bash',
            result: 'file.txt',
            isError: false,
          },
        ],
      },
    ];

    const turns = reconstructTurnsFromMessages(messages);
    expect(turns.length).toBe(1);
    expect(turns[0]?.reasoning).toBe('thinking...');
    expect(turns[0]?.text).toBe('Here are the files');
    expect(turns[0]?.toolCalls.length).toBe(1);
    expect(turns[0]?.toolCalls[0]?.toolName).toBe('bash');
    expect(turns[0]?.toolCalls[0]?.status).toBe('success');
  });
});
