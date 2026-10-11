import { describe, it, expect } from 'bun:test';
import { composePrompt } from './PromptComposer.js';
import type { ModelMessage } from '@steward/threads';

describe('composePrompt', () => {
  it('throws an error if user prompt is empty or blank', () => {
    expect(() =>
      composePrompt({
        historyMessages: [],
        newUserPrompt: '   ',
      }),
    ).toThrow('Cannot compose prompt with empty user input');
  });

  it('preserves history containing tool calls and tool results without flattening', () => {
    const history: ModelMessage[] = [
      {
        role: 'user',
        content: 'Read file',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'read',
            args: { path: 'package.json' },
          },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call_1',
            toolName: 'read',
            result: '{"name": "steward"}',
          },
        ],
      },
    ];

    const composed = composePrompt({
      systemPrompt: 'You are Steward.',
      historyMessages: history,
      newUserPrompt: 'What is the package name?',
    });

    expect(composed.systemPrompt).toBe('You are Steward.');
    expect(composed.messages.length).toBe(4);
    expect(composed.messages[0].role).toBe('user');
    expect(composed.messages[1].role).toBe('assistant');
    expect(composed.messages[2].role).toBe('tool');
    expect(composed.messages[3]).toEqual({
      role: 'user',
      content: 'What is the package name?',
    });
  });
});
