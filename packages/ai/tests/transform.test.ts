import { describe, it, expect } from 'bun:test';
import { transformMessages, defaultNormalizeToolCallId } from '../src/transform/messages.ts';
import type { AssistantMessage, Message, Model, ToolMessage, UserMessage } from '../src/types.ts';

describe('transform/messages — Cross-Model Handoff', () => {
  const claudeModel: Model = {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    protocol: 'anthropic-messages',
    baseUrl: '',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  const gptModel: Model = {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    protocol: 'openai-responses',
    baseUrl: '',
    reasoning: true,
    maxOutputTokens: 8192,
  };

  it('preserves thinking block when target is the same model', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'internal logic' }],
        meta: {
          provider: 'anthropic',
          protocol: 'anthropic-messages',
          modelId: 'claude-sonnet-4-5',
        },
      },
    ];

    const res = transformMessages(messages, claudeModel);
    const assistant = res[0] as AssistantMessage;
    expect(assistant.content[0].type).toBe('thinking');
  });

  it('converts foreign thinking blocks to plain text for a different model', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: 'claude reasoning' }],
        meta: {
          provider: 'anthropic',
          protocol: 'anthropic-messages',
          modelId: 'claude-sonnet-4-5',
        },
      },
    ];

    const res = transformMessages(messages, gptModel);
    const assistant = res[0] as AssistantMessage;
    expect(assistant.content[0].type).toBe('text');
    if (assistant.content[0].type === 'text') {
      expect(assistant.content[0].text).toBe('claude reasoning');
    }
  });

  it('drops redacted thinking blocks when sending to a foreign model', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [{ type: 'thinking', thinking: '', redacted: true }],
        meta: {
          provider: 'anthropic',
          protocol: 'anthropic-messages',
          modelId: 'claude-sonnet-4-5',
        },
      },
    ];

    const res = transformMessages(messages, gptModel);
    const assistant = res[0] as AssistantMessage;
    expect(assistant.content).toHaveLength(0);
  });

  it('synthesizes results for orphaned tool calls', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: 'call_1',
            name: 'bash',
            arguments: { cmd: 'ls' },
          },
        ],
      },
      {
        role: 'user',
        content: 'Next turn without tool result',
      },
    ];

    const res = transformMessages(messages, claudeModel);
    // An inserted tool message must exist before the user message
    expect(res).toHaveLength(3);
    expect(res[0].role).toBe('assistant');
    expect(res[1].role).toBe('tool');
    expect(res[2].role).toBe('user');

    const toolMsg = res[1] as ToolMessage;
    expect(toolMsg.content[0].toolCallId).toBe('call_1');
    expect(toolMsg.content[0].isError).toBe(true);
  });

  it('skips errored or aborted assistant turns on replay', () => {
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'interrupted answer' }],
        meta: {
          provider: 'openai',
          protocol: 'openai-responses',
          modelId: 'gpt-5.4',
          finishReason: 'aborted',
        },
      },
      {
        role: 'user',
        content: 'Please try again',
      },
    ];

    const res = transformMessages(messages, gptModel);
    expect(res).toHaveLength(1);
    expect(res[0].role).toBe('user');
  });

  it('normalizes foreign tool call IDs and updates tool results mapping', () => {
    const longId = 'response_item_with_pipe|and_special@characters_1234567890_abcdef';
    const messages: Message[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: longId,
            name: 'read_file',
            arguments: {},
          },
        ],
        meta: {
          provider: 'openai',
          protocol: 'openai-responses',
          modelId: 'gpt-5.4',
        },
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: longId,
            toolName: 'read_file',
            output: 'file content',
          },
        ],
      },
    ];

    const res = transformMessages(messages, claudeModel);
    const assistant = res[0] as AssistantMessage;
    const toolMsg = res[1] as ToolMessage;

    const normalizedTcId = (assistant.content[0] as { id: string }).id;
    expect(normalizedTcId).not.toContain('|');
    expect(normalizedTcId).not.toContain('@');
    expect(toolMsg.content[0].toolCallId).toBe(normalizedTcId);
  });

  it('preserves image content when target model supports images', () => {
    const visionModel: Model = {
      ...claudeModel,
      input: ['text', 'image'],
    };

    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this image:' },
          { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
        ],
      },
    ];

    const res = transformMessages(messages, visionModel);
    const userMsg = res[0] as UserMessage;
    expect(Array.isArray(userMsg.content)).toBe(true);
    const parts = userMsg.content as Array<{ type: string; text?: string; data?: string }>;
    expect(parts).toHaveLength(2);
    expect(parts[0].type).toBe('text');
    expect(parts[1].type).toBe('image');
    expect(parts[1].data).toBeDefined();
  });

  it('downgrades image content to text placeholder when model lacks vision support', () => {
    const textOnlyModel: Model = {
      ...claudeModel,
      input: ['text'],
    };

    const messages: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is a screenshot:' },
          { type: 'image', mimeType: 'image/jpeg', data: 'dGVzdA==' },
        ],
      },
    ];

    const res = transformMessages(messages, textOnlyModel);
    const userMsg = res[0] as UserMessage;
    expect(Array.isArray(userMsg.content)).toBe(true);
    const parts = userMsg.content as Array<{ type: string; text?: string }>;
    expect(parts).toHaveLength(2);
    expect(parts[0].text).toBe('Here is a screenshot:');
    expect(parts[1].type).toBe('text');
    expect(parts[1].text).toBe('[image omitted: model does not support images]');
  });
});
