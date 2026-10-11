import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { adaptTools } from './index.js';
import { Tool, type ToolExecutionResult } from '../../tools/Tool.js';
import type { AgentToolCallStartEvent, AgentToolCallResultEvent } from '../types.js';

class MockSuccessTool extends Tool<any, string> {
  name = 'mockSuccess';
  description = 'A mock success tool';
  glyph = '✓';
  schema = z.object({
    query: z.string(),
    tagline: z.string(),
  });

  async execute(args: { query: string; tagline: string }): Promise<ToolExecutionResult<string>> {
    return this.success(`Found result for: ${args.query}`, `Found result for: ${args.query}`);
  }
}

class MockErrorTool extends Tool<any, unknown> {
  name = 'mockError';
  description = 'A mock failing tool';
  glyph = '✖';
  schema = z.object({
    tagline: z.string(),
  });

  async execute(): Promise<never> {
    throw new Error('Permission denied to read file');
  }
}

describe('adaptTools (AI SDK Tool Bridge)', () => {
  it('adapts Steward Tools to AI SDK format with valid schemas and descriptions', () => {
    const tools = adaptTools([new MockSuccessTool(), new MockErrorTool()]);

    expect(tools.mockSuccess).toBeDefined();
    expect(tools.mockSuccess.description).toBe('A mock success tool');
    expect(tools.mockError).toBeDefined();
    expect(tools.mockError.description).toBe('A mock failing tool');
  });

  it('executes successful tool and emits tool-call-start and tool-call-result events to caller', async () => {
    const startEvents: AgentToolCallStartEvent[] = [];
    const resultEvents: AgentToolCallResultEvent[] = [];

    const tools = adaptTools([new MockSuccessTool()], {
      onToolStart: (e) => startEvents.push(e),
      onToolResult: (e) => resultEvents.push(e),
    });

    const output = await tools.mockSuccess.execute?.(
      { query: 'foo', tagline: 'Searching for foo' },
      { toolCallId: 'call_123' } as any,
    );

    expect(output.success).toBe(true);
    expect(output.output).toBe('Found result for: foo');
    expect(startEvents.length).toBe(1);
    expect(startEvents[0].toolName).toBe('mockSuccess');
    expect(startEvents[0].tagline).toBe('Searching for foo');

    expect(resultEvents.length).toBe(1);
    expect(resultEvents[0].isError).toBe(false);
    expect(resultEvents[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it('catches tool execution errors, emits error result event, and returns recovery payload to model', async () => {
    const resultEvents: AgentToolCallResultEvent[] = [];

    const tools = adaptTools([new MockErrorTool()], {
      onToolResult: (e) => resultEvents.push(e),
    });

    const output = await tools.mockError.execute?.({ tagline: 'Attempting invalid operation' }, {
      toolCallId: 'call_456',
    } as any);

    expect(output).toEqual({
      isError: true,
      error: 'Permission denied to read file',
    });

    expect(resultEvents.length).toBe(1);
    expect(resultEvents[0].isError).toBe(true);
    expect(resultEvents[0].result).toBe('Permission denied to read file');
  });

  it('correctly marks isError: true when a tool resolves with success: false', async () => {
    class MockFailureResultTool extends Tool<any, unknown> {
      name = 'mockFailureResult';
      description = 'Resolves with failure result';
      glyph = '✖';
      schema = z.object({ tagline: z.string() });
      async execute() {
        return this.error('Operation failed gracefully');
      }
    }

    const resultEvents: AgentToolCallResultEvent[] = [];
    const tools = adaptTools([new MockFailureResultTool()], {
      onToolResult: (e) => resultEvents.push(e),
    });

    const output = await tools.mockFailureResult.execute?.(
      { tagline: 'Running failure' },
      { toolCallId: 'call_fail' } as any,
    );

    expect(output.success).toBe(false);
    expect(resultEvents.length).toBe(1);
    expect(resultEvents[0].isError).toBe(true);
  });

  it('forwards threadId, askPermission, and onProgress to tool execution context', async () => {
    let capturedContext: any = null;

    class MockContextInspectorTool extends Tool<any, unknown> {
      name = 'mockContextInspector';
      description = 'Captures execution context';
      glyph = '🔍';
      schema = z.object({ tagline: z.string() });
      async execute(_args: any, context: any) {
        capturedContext = context;
        return this.success('OK');
      }
    }

    const dummyAskPermission = async () => true;
    const dummyOnProgress = () => {};

    const tools = adaptTools([new MockContextInspectorTool()], {
      cwd: '/test/workspace',
      threadId: 'th_test_123',
      askPermission: dummyAskPermission,
      onProgress: dummyOnProgress,
    });

    await tools.mockContextInspector.execute?.(
      { tagline: 'Inspecting context' },
      { toolCallId: 'call_ctx' } as any,
    );

    expect(capturedContext).toBeDefined();
    expect(capturedContext.cwd).toBe('/test/workspace');
    expect(capturedContext.threadId).toBe('th_test_123');
    expect(capturedContext.askPermission).toBe(dummyAskPermission);
    expect(capturedContext.onProgress).toBe(dummyOnProgress);
  });
});
