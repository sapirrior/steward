import { describe, expect, it } from 'bun:test';
import { runAgentLoop, accumulateTokenUsage } from './agentLoop.js';
import type {
  AssistantMessage,
  Message,
  ModelStream,
  StreamEvent,
  StreamResult,
  ToolCallContent,
  ToolResult,
} from './types.js';
import type { AgentEvent } from './events.js';

function createMockStream(events: StreamEvent[], finalResult: StreamResult): () => ModelStream {
  return () => ({
    async *[Symbol.asyncIterator]() {
      for (const ev of events) {
        yield ev;
      }
    },
    async result() {
      return finalResult;
    },
  });
}

describe('runAgentLoop', () => {
  it('handles a plain text turn with natural finish reason', async () => {
    const textEvents: StreamEvent[] = [
      { type: 'text-delta', delta: 'Hello, ' },
      { type: 'text-delta', delta: 'world!' },
    ];
    const streamResult: StreamResult = {
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello, world!' }],
      },
      usage: { input: 10, output: 5, total: 15 },
      finishReason: 'stop',
    };

    const events: AgentEvent[] = [];
    const stream = createMockStream(textEvents, streamResult);

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Hi' }],
      stream: () => stream(),
      executeTool: async () => {
        throw new Error('should not be called');
      },
      onEvent: (ev) => events.push(ev),
    });

    expect(result.stopReason).toBe('natural');
    expect(result.text).toBe('Hello, world!');
    expect(result.usage.total).toBe(15);
    expect(result.newMessages.length).toBe(1);
    expect(result.newMessages[0]?.role).toBe('assistant');

    // Event assertions
    expect(events[0]?.type).toBe('agent-start');
    expect(events[events.length - 1]?.type).toBe('agent-end');
  });

  it('executes a tool call and completes next step', async () => {
    let stepCount = 0;

    const streamFn = () => {
      stepCount++;
      if (stepCount === 1) {
        const toolCall: ToolCallContent = {
          type: 'tool-call',
          id: 'call_1',
          name: 'get_weather',
          arguments: { city: 'SF' },
        };
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'tool-call-start' as const, id: 'call_1', name: 'get_weather' };
            yield { type: 'tool-call-end' as const, toolCall };
          },
          async result(): Promise<StreamResult> {
            return {
              message: {
                role: 'assistant',
                content: [toolCall],
              },
              usage: { input: 10, output: 5, total: 15 },
              finishReason: 'tool_calls',
            };
          },
        };
      } else {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'text-delta' as const, delta: 'The weather is sunny.' };
          },
          async result(): Promise<StreamResult> {
            return {
              message: {
                role: 'assistant',
                content: [{ type: 'text', text: 'The weather is sunny.' }],
              },
              usage: { input: 20, output: 10, total: 30 },
              finishReason: 'stop',
            };
          },
        };
      }
    };

    const executedCalls: ToolCallContent[] = [];
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'What is the weather?' }],
      stream: streamFn,
      executeTool: async (call) => {
        executedCalls.push(call);
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: '72 degrees, sunny',
          isError: false,
        };
      },
    });

    expect(result.stopReason).toBe('natural');
    expect(executedCalls.length).toBe(1);
    expect(executedCalls[0]?.name).toBe('get_weather');
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0]?.result).toBe('72 degrees, sunny');
    expect(result.usage.total).toBe(45); // 15 + 30
    expect(result.newMessages.length).toBe(3); // Assistant(tool-call) -> Tool(tool-result) -> Assistant(text)
  });

  it('handles tool execution throw safely without breaking loop', async () => {
    let stepCount = 0;
    const streamFn = () => {
      stepCount++;
      if (stepCount === 1) {
        const toolCall: ToolCallContent = {
          type: 'tool-call',
          id: 'call_err',
          name: 'failing_tool',
          arguments: {},
        };
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'tool-call-end' as const, toolCall };
          },
          async result(): Promise<StreamResult> {
            return {
              message: { role: 'assistant', content: [toolCall] },
              usage: { input: 10, output: 5, total: 15 },
              finishReason: 'tool_calls',
            };
          },
        };
      } else {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'text-delta' as const, delta: 'Handled error.' };
          },
          async result(): Promise<StreamResult> {
            return {
              message: { role: 'assistant', content: [{ type: 'text', text: 'Handled error.' }] },
              usage: { input: 10, output: 5, total: 15 },
              finishReason: 'stop',
            };
          },
        };
      }
    };

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run tool' }],
      stream: streamFn,
      executeTool: async () => {
        throw new Error('Disk error');
      },
    });

    expect(result.stopReason).toBe('natural');
    expect(result.toolResults.length).toBe(1);
    expect(result.toolResults[0]?.isError).toBe(true);
    expect(result.toolResults[0]?.result).toBe('Disk error');
  });

  it('synthesizes error tool results and tool-execution-end events when aborted mid-tool list', async () => {
    const controller = new AbortController();
    const toolCall1: ToolCallContent = {
      type: 'tool-call',
      id: 'c1',
      name: 'tool1',
      arguments: {},
    };
    const toolCall2: ToolCallContent = {
      type: 'tool-call',
      id: 'c2',
      name: 'tool2',
      arguments: {},
    };

    const stream = () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'tool-call-end' as const, toolCall: toolCall1 };
        yield { type: 'tool-call-end' as const, toolCall: toolCall2 };
      },
      async result(): Promise<StreamResult> {
        return {
          message: { role: 'assistant', content: [toolCall1, toolCall2] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'tool_calls',
        };
      },
    });

    const events: AgentEvent[] = [];
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run both' }],
      stream,
      signal: controller.signal,
      executeTool: async (call) => {
        if (call.id === 'c1') {
          controller.abort(); // Abort during first tool execution
          return {
            id: call.id,
            name: call.name,
            args: call.arguments,
            result: 'done1',
            isError: false,
          };
        }
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'done2',
          isError: false,
        };
      },
      onEvent: (ev) => events.push(ev),
    });

    expect(result.stopReason).toBe('aborted');
    expect(result.toolResults.length).toBe(2);
    expect(result.toolResults[0]?.result).toBe('done1');
    expect(result.toolResults[1]?.result).toBe('Aborted by user');
    expect(result.toolResults[1]?.isError).toBe(true);

    const endEvents = events.filter((e) => e.type === 'tool-execution-end');
    expect(endEvents.length).toBe(2);
  });

  it('drops uncompleted tool-call blocks when aborted during model streaming', async () => {
    const controller = new AbortController();
    const completedCall: ToolCallContent = {
      type: 'tool-call',
      id: 'c1',
      name: 't1',
      arguments: {},
    };
    const uncompletedCall: ToolCallContent = {
      type: 'tool-call',
      id: 'c2',
      name: 't2',
      arguments: {},
    };

    const stream = () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'tool-call-end' as const, toolCall: completedCall };
        yield { type: 'tool-call-start' as const, id: 'c2', name: 't2' };
        controller.abort();
      },
      async result(): Promise<StreamResult> {
        return {
          message: { role: 'assistant', content: [completedCall, uncompletedCall] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'error',
          error: { name: 'AbortError', message: 'The user aborted', code: 'aborted' },
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Test' }],
      stream,
      signal: controller.signal,
      executeTool: async () => ({ id: '1', name: '1', args: {}, result: 'ok', isError: false }),
    });

    expect(result.stopReason).toBe('aborted');
    // Only completedCall is preserved, uncompletedCall was dropped
    const assistantMsg = result.newMessages.find((m) => m.role === 'assistant') as AssistantMessage;
    expect(assistantMsg).toBeDefined();
    expect(assistantMsg.content.length).toBe(1);
    expect(assistantMsg.content[0]?.type).toBe('tool-call');
    expect((assistantMsg.content[0] as ToolCallContent).id).toBe('c1');
  });

  it('correctly classifies step-limit only when tools were requested on the last step', async () => {
    const toolCall: ToolCallContent = { type: 'tool-call', id: 'c1', name: 't1', arguments: {} };
    const toolStream = () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'tool-call-end' as const, toolCall };
      },
      async result(): Promise<StreamResult> {
        return {
          message: { role: 'assistant', content: [toolCall] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'tool_calls',
        };
      },
    });

    const resultLimit = await runAgentLoop({
      messages: [{ role: 'user', content: 'Test' }],
      stream: toolStream,
      maxSteps: 1,
      executeTool: async () => ({ id: '1', name: '1', args: {}, result: 'ok', isError: false }),
    });
    expect(resultLimit.stopReason).toBe('step-limit');

    const textStream = () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'text-delta' as const, delta: 'Just text' };
      },
      async result(): Promise<StreamResult> {
        return {
          message: { role: 'assistant', content: [{ type: 'text', text: 'Just text' }] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'stop',
        };
      },
    });

    const resultNatural = await runAgentLoop({
      messages: [{ role: 'user', content: 'Test' }],
      stream: textStream,
      maxSteps: 1,
      executeTool: async () => ({ id: '1', name: '1', args: {}, result: 'ok', isError: false }),
    });
    expect(resultNatural.stopReason).toBe('natural');
  });

  it('catches listener exceptions in onEvent so UI crashes do not break turn loop', async () => {
    const stream = () => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'text-delta' as const, delta: 'Hi' };
      },
      async result(): Promise<StreamResult> {
        return {
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'stop',
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Test' }],
      stream,
      executeTool: async () => ({ id: '1', name: '1', args: {}, result: 'ok', isError: false }),
      onEvent: () => {
        throw new Error('Listener crash!');
      },
    });

    expect(result.stopReason).toBe('natural');
    expect(result.text).toBe('Hi');
  });
});
