import { describe, expect, it } from 'bun:test';
import { runAgentTurn } from '../src/packages/agents/src/engine/agent-runner.js';
import type { AIEngine, InferenceRequest, InferenceStream } from '@steward/ai';

describe('runAgentTurn Integration', () => {
  it('executes a single step turn without tools', async () => {
    const mockAIEngine: AIEngine = {
      auth: {} as any,
      async resolveModel() {
        return { provider: 'openai', modelId: 'gpt-4o-mini', effort: 'medium' };
      },
      stream(request: InferenceRequest): InferenceStream {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'text-delta', delta: 'Hello from mock AI!' };
          },
          async result() {
            return {
              message: {
                role: 'assistant',
                content: [{ type: 'text', text: 'Hello from mock AI!' }],
              },
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              finishReason: 'stop',
            };
          },
        };
      },
    };

    const summary = await runAgentTurn({
      ai: mockAIEngine,
      model: { provider: 'openai', modelId: 'gpt-4o-mini', effort: 'medium' },
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(summary.text).toBe('Hello from mock AI!');
    expect(summary.usage.totalTokens).toBe(15);
    expect(summary.stopReason).toBe('natural');
  });

  it('executes tool call and continues turn sequentially', async () => {
    let callCount = 0;

    const mockAIEngine: AIEngine = {
      auth: {} as any,
      async resolveModel() {
        return { provider: 'openai', modelId: 'gpt-4o-mini', effort: 'medium' };
      },
      stream(request: InferenceRequest): InferenceStream {
        callCount++;
        if (callCount === 1) {
          // Model requests tool call
          return {
            async *[Symbol.asyncIterator]() {
              yield {
                type: 'tool-call-end',
                toolCall: {
                  type: 'tool-call',
                  id: 'call_1',
                  name: 'test_tool',
                  arguments: { q: 'query' },
                },
              };
            },
            async result() {
              return {
                message: {
                  role: 'assistant',
                  content: [
                    {
                      type: 'tool-call',
                      id: 'call_1',
                      name: 'test_tool',
                      arguments: { q: 'query' },
                    },
                  ],
                },
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                finishReason: 'tool-use',
              };
            },
          };
        } else {
          // Model responds after tool output
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: 'text-delta', delta: 'Tool output processed.' };
            },
            async result() {
              return {
                message: {
                  role: 'assistant',
                  content: [{ type: 'text', text: 'Tool output processed.' }],
                },
                usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
                finishReason: 'stop',
              };
            },
          };
        }
      },
    };

    const executedTools: string[] = [];
    const summary = await runAgentTurn({
      ai: mockAIEngine,
      model: { provider: 'openai', modelId: 'gpt-4o-mini', effort: 'medium' },
      messages: [{ role: 'user', content: 'Run test tool' }],
      toolExecutor: async (call) => {
        executedTools.push(call.name);
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: { success: true },
          isError: false,
        };
      },
    });

    expect(executedTools).toEqual(['test_tool']);
    expect(summary.text).toBe('Tool output processed.');
    expect(summary.usage.totalTokens).toBe(35);
    expect(summary.toolCalls.length).toBe(1);
  });
});
