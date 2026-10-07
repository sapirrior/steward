import { describe, expect, it } from 'bun:test';
import { runAgentLoop } from './agentLoop.js';
import type {
  AssistantMessage,
  Message,
  ModelStream,
  StreamEvent,
  StreamResult,
  StreamRequest,
  ToolCallContent,
  ToolResult,
} from './types.js';
import type { AgentEvent } from './events.js';

function createMockStream(
  events: StreamEvent[],
  result: StreamResult,
): (req: StreamRequest) => ModelStream {
  return () => {
    return {
      async *[Symbol.asyncIterator]() {
        for (const event of events) {
          yield event;
        }
      },
      async result() {
        return result;
      },
    };
  };
}

describe('runAgentLoop', () => {
  it('executes a text-only single step turn naturally', async () => {
    const assistantMsg: AssistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello, world!' }],
    };

    const stream = createMockStream([{ type: 'text-delta', delta: 'Hello, world!' }], {
      message: assistantMsg,
      usage: { input: 10, output: 5, total: 15 },
      finishReason: 'stop',
    });

    const events: AgentEvent[] = [];
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Hi' }],
      stream,
      executeTool: async () => {
        throw new Error('No tools expected');
      },
      onEvent: (ev) => events.push(ev),
    });

    expect(result.stopReason).toBe('natural');
    expect(result.text).toBe('Hello, world!');
    expect(result.usage.total).toBe(15);
    expect(result.newMessages).toHaveLength(1);
    expect(result.newMessages[0]).toEqual(assistantMsg);

    const eventTypes = events.map((e) => e.type);
    expect(eventTypes).toContain('agent-start');
    expect(eventTypes).toContain('turn-start');
    expect(eventTypes).toContain('message-start');
    expect(eventTypes).toContain('message-update');
    expect(eventTypes).toContain('message-end');
    expect(eventTypes).toContain('turn-end');
    expect(eventTypes).toContain('agent-end');
  });

  it('executes single tool call and follows up with assistant response', async () => {
    const toolCall: ToolCallContent = {
      type: 'tool-call',
      id: 'call_1',
      name: 'read_file',
      arguments: { path: 'test.txt' },
    };

    const step1Msg: AssistantMessage = {
      role: 'assistant',
      content: [toolCall],
    };

    const step2Msg: AssistantMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'File contents read.' }],
    };

    let stepCount = 0;
    const streamFn = (req: StreamRequest): ModelStream => {
      stepCount++;
      if (stepCount === 1) {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'tool-call-start', id: 'call_1', name: 'read_file' };
            yield { type: 'tool-call-end', toolCall };
          },
          async result() {
            return {
              message: step1Msg,
              usage: { input: 20, output: 10, total: 30 },
              finishReason: 'tool_calls',
            };
          },
        };
      }
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', delta: 'File contents read.' };
        },
        async result() {
          return {
            message: step2Msg,
            usage: { input: 35, output: 5, total: 40 },
            finishReason: 'stop',
          };
        },
      };
    };

    const toolExecutions: string[] = [];
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Read test.txt' }],
      stream: streamFn,
      executeTool: async (call) => {
        toolExecutions.push(call.name);
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'file content here',
          isError: false,
        };
      },
    });

    expect(toolExecutions).toEqual(['read_file']);
    expect(result.stopReason).toBe('natural');
    expect(result.text).toBe('File contents read.');
    expect(result.usage.total).toBe(70); // 30 + 40
    expect(result.newMessages).toHaveLength(3); // Assistant(tool) -> Tool(result) -> Assistant(final)
    expect(result.newMessages[1].role).toBe('tool');
  });

  it('executes multiple tool calls sequentially in model order', async () => {
    const call1: ToolCallContent = {
      type: 'tool-call',
      id: 'call_1',
      name: 'tool_a',
      arguments: {},
    };
    const call2: ToolCallContent = {
      type: 'tool-call',
      id: 'call_2',
      name: 'tool_b',
      arguments: {},
    };

    const step1Msg: AssistantMessage = {
      role: 'assistant',
      content: [call1, call2],
    };

    let stepCount = 0;
    const executionOrder: string[] = [];

    const streamFn = (): ModelStream => {
      stepCount++;
      if (stepCount === 1) {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'tool-call-end', toolCall: call1 };
            yield { type: 'tool-call-end', toolCall: call2 };
          },
          async result() {
            return {
              message: step1Msg,
              usage: { input: 10, output: 10, total: 20 },
              finishReason: 'tool_calls',
            };
          },
        };
      }
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', delta: 'Done both' };
        },
        async result() {
          return {
            message: { role: 'assistant', content: [{ type: 'text', text: 'Done both' }] },
            usage: { input: 20, output: 5, total: 25 },
            finishReason: 'stop',
          };
        },
      };
    };

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run tools' }],
      stream: streamFn,
      executeTool: async (call) => {
        executionOrder.push(call.name);
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: `ok_${call.name}`,
          isError: false,
        };
      },
    });

    expect(executionOrder).toEqual(['tool_a', 'tool_b']);
    expect(result.stopReason).toBe('natural');
    expect(result.toolResults).toHaveLength(2);
  });

  it('handles tool execution throw by capturing error and continuing loop', async () => {
    const call1: ToolCallContent = {
      type: 'tool-call',
      id: 'call_err',
      name: 'faulty_tool',
      arguments: {},
    };

    let stepCount = 0;
    const streamFn = (): ModelStream => {
      stepCount++;
      if (stepCount === 1) {
        return {
          async *[Symbol.asyncIterator]() {
            yield { type: 'tool-call-end', toolCall: call1 };
          },
          async result() {
            return {
              message: { role: 'assistant', content: [call1] },
              usage: { input: 10, output: 5, total: 15 },
              finishReason: 'tool_calls',
            };
          },
        };
      }
      return {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text-delta', delta: 'Recovered from error' };
        },
        async result() {
          return {
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Recovered from error' }],
            },
            usage: { input: 15, output: 5, total: 20 },
            finishReason: 'stop',
          };
        },
      };
    };

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run faulty' }],
      stream: streamFn,
      executeTool: async () => {
        throw new Error('Disk read failure');
      },
    });

    expect(result.stopReason).toBe('natural');
    expect(result.toolResults[0].isError).toBe(true);
    expect(result.toolResults[0].result).toContain('Disk read failure');
  });

  it('handles mid-turn abort by synthesizing error results for unexecuted calls', async () => {
    const abortCtrl = new AbortController();
    const call1: ToolCallContent = {
      type: 'tool-call',
      id: 'c1',
      name: 't1',
      arguments: {},
    };
    const call2: ToolCallContent = {
      type: 'tool-call',
      id: 'c2',
      name: 't2',
      arguments: {},
    };

    const streamFn = (): ModelStream => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'tool-call-end', toolCall: call1 };
        yield { type: 'tool-call-end', toolCall: call2 };
      },
      async result() {
        return {
          message: { role: 'assistant', content: [call1, call2] },
          usage: { input: 10, output: 10, total: 20 },
          finishReason: 'tool_calls',
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run abort test' }],
      stream: streamFn,
      signal: abortCtrl.signal,
      executeTool: async (call) => {
        if (call.name === 't1') {
          abortCtrl.abort(); // Abort during first tool execution
          return {
            id: call.id,
            name: call.name,
            args: call.arguments,
            result: 't1_done',
            isError: false,
          };
        }
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'should not run',
          isError: false,
        };
      },
    });

    expect(result.stopReason).toBe('aborted');
    expect(result.toolResults).toHaveLength(2);
    expect(result.toolResults[0].result).toBe('t1_done');
    expect(result.toolResults[1].result).toBe('Aborted by user');
    expect(result.toolResults[1].isError).toBe(true);
  });

  it('correctly classifies step-limit only when tools were requested on max step', async () => {
    const toolCall: ToolCallContent = {
      type: 'tool-call',
      id: 'c_limit',
      name: 'loop_tool',
      arguments: {},
    };

    const streamFn = (): ModelStream => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'tool-call-end', toolCall };
      },
      async result() {
        return {
          message: { role: 'assistant', content: [toolCall] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'tool_calls',
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Infinite tools' }],
      stream: streamFn,
      maxSteps: 1, // Stop after step 1
      executeTool: async (call) => ({
        id: call.id,
        name: call.name,
        args: call.arguments,
        result: 'ok',
        isError: false,
      }),
    });

    expect(result.stopReason).toBe('step-limit');
  });

  it('classifies natural stop when plain answer is given on the last allowed step', async () => {
    const streamFn = (): ModelStream => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'text-delta', delta: 'Single step answer' };
      },
      async result() {
        return {
          message: { role: 'assistant', content: [{ type: 'text', text: 'Single step answer' }] },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'stop',
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Answer me' }],
      stream: streamFn,
      maxSteps: 1,
      executeTool: async () => {
        throw new Error('Unused');
      },
    });

    expect(result.stopReason).toBe('natural');
  });

  it('safely catches listener exceptions and finishes the turn', async () => {
    const streamFn = (): ModelStream => ({
      async *[Symbol.asyncIterator]() {
        yield { type: 'text-delta', delta: 'Hello' };
      },
      async result() {
        return {
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
          usage: { input: 5, output: 2, total: 7 },
          finishReason: 'stop',
        };
      },
    });

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Test throw' }],
      stream: streamFn,
      executeTool: async () => {
        throw new Error('Unused');
      },
      onEvent: () => {
        throw new Error('Faulty listener');
      },
    });

    expect(result.stopReason).toBe('natural');
    expect(result.text).toBe('Hello');
  });
});
