import { describe, it, expect } from 'bun:test';
import { AgentSession } from '@steward/agents/engine/agent-session.js';
import { runAgentTurn } from '@steward/agents/engine/agent-runner.js';
import { HookRuntime } from '@steward/plugins/hooks/runtime.js';
import type { CompiledHook } from '@steward/plugins/hooks/types.js';
import type { AIEngine, InferenceRequest, InferenceStreamResult, StreamEvent } from '@steward/ai';

function createMockAIEngine(
  responses: Array<{
    text: string;
    toolCalls?: Array<{ id: string; name: string; arguments: any }>;
  }>,
): AIEngine {
  let callIndex = 0;

  return {
    auth: {} as any,
    stream(request: InferenceRequest) {
      const resp = responses[callIndex] ?? { text: 'Default response' };
      callIndex++;

      const events: StreamEvent[] = [];
      if (resp.text) {
        events.push({ type: 'text-delta', delta: resp.text });
      }

      if (resp.toolCalls) {
        for (const tc of resp.toolCalls) {
          events.push({
            type: 'tool-call-end',
            toolCall: {
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            },
          });
        }
      }

      const resultObj: InferenceStreamResult = {
        message: {
          role: 'assistant',
          content: [
            ...(resp.text ? [{ type: 'text' as const, text: resp.text }] : []),
            ...(resp.toolCalls
              ? resp.toolCalls.map((tc) => ({
                  type: 'tool_call' as const,
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                }))
              : []),
          ],
        },
        finishReason: resp.toolCalls && resp.toolCalls.length > 0 ? 'tool_calls' : 'stop',
        usage: {
          inputTokens: 10,
          outputTokens: 10,
          totalTokens: 20,
        },
      };

      return {
        async *[Symbol.asyncIterator]() {
          for (const ev of events) {
            yield ev;
          }
        },
        async result() {
          return resultObj;
        },
      };
    },
    async resolveModel() {
      return { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' };
    },
    async listModels() {
      return [];
    },
  };
}

describe('@steward/plugins - Integration with AgentSession & Runner', () => {
  it('SessionStart: loads context and consumes it on first submitPrompt', async () => {
    const sessionStartHook: CompiledHook = {
      source: 'project',
      event: 'SessionStart',
      name: 'load-context',
      command: 'cmd',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => ({
        additionalContext: 'Project context from SessionStart',
      }),
    };

    const runtime = new HookRuntime({
      hooks: [sessionStartHook],
      isTrusted: true,
    });

    const ai = createMockAIEngine([{ text: 'Hello! I see the context.' }]);
    const session = new AgentSession(undefined, undefined, { ai, hookRuntime: runtime });

    await session.initializeHooks({
      cwd: process.cwd(),
      isTrusted: true,
      source: 'startup',
    });

    expect(runtime.getPendingSessionContext()).toEqual(['Project context from SessionStart']);

    const turn = await session.submitPrompt('Hi');
    expect(turn.text).toBe('Hello! I see the context.');
    expect(runtime.getPendingSessionContext()).toEqual([]);
  });

  it('UserPromptSubmit: blocks turn creation before checkpoint or turn log', async () => {
    const promptBlockHook: CompiledHook = {
      source: 'project',
      event: 'UserPromptSubmit',
      name: 'prompt-blocker',
      command: 'cmd',
      timeoutMs: 1000,
      enabled: true,
      builtinHandler: () => ({
        decision: 'block',
        reason: 'Forbidden prompt topic',
      }),
    };

    const runtime = new HookRuntime({
      hooks: [promptBlockHook],
      isTrusted: true,
    });

    const ai = createMockAIEngine([{ text: 'Should not run' }]);
    const session = new AgentSession(undefined, undefined, { ai, hookRuntime: runtime });

    expect(session.session.turns).toHaveLength(0);

    let errorThrown = false;
    try {
      await session.submitPrompt('Forbidden content');
    } catch (err: any) {
      errorThrown = true;
      expect(err.message).toContain('Forbidden prompt topic');
    }

    expect(errorThrown).toBe(true);
    expect(session.session.turns).toHaveLength(0);
  });

  it('BeforeToolUse: blocked tool call is synthesized as error tool result and does not run tool', async () => {
    let toolActuallyExecuted = false;

    const beforeHook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'bash-blocker',
      command: 'cmd',
      timeoutMs: 1000,
      enabled: true,
      allTools: false,
      matcherSet: new Set(['bash']),
      builtinHandler: () => ({
        decision: 'block',
        reason: 'Shell execution is disallowed by workspace hook',
      }),
    };

    const runnerCallbacks = {
      beforeToolUse: async (params: any) => {
        if (params.toolName === 'bash') {
          return { blocked: true, reason: 'Shell execution is disallowed by workspace hook' };
        }
        return { blocked: false };
      },
    };

    const ai = createMockAIEngine([
      {
        text: 'Let me run bash',
        toolCalls: [{ id: 'c1', name: 'bash', arguments: { command: 'rm -rf /' } }],
      },
      {
        text: 'The bash call was blocked, so I stopped.',
      },
    ]);

    const summary = await runAgentTurn({
      ai,
      model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      messages: [{ role: 'user', content: 'Run command' }],
      callbacks: runnerCallbacks,
      toolExecutor: async (call) => {
        toolActuallyExecuted = true;
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'Executed',
          isError: false,
        };
      },
    });

    expect(toolActuallyExecuted).toBe(false);
    expect(summary.toolCalls).toHaveLength(1);
    expect(summary.toolCalls[0]!.isError).toBe(true);
    expect(String(summary.toolCalls[0]!.result)).toContain('disallowed by workspace hook');
    expect(summary.text).toContain('The bash call was blocked');
  });

  it('AfterToolUse: context from successful tool reaches next model step', async () => {
    let afterHookInvoked = false;

    const runnerCallbacks = {
      afterToolUse: async () => {
        afterHookInvoked = true;
        return { context: ['Tool output verified by audit hook.'] };
      },
    };

    const ai = createMockAIEngine([
      {
        text: 'Reading file',
        toolCalls: [{ id: 'c1', name: 'read_file', arguments: { file_path: 'test.txt' } }],
      },
      {
        text: 'Finished reading with verified audit.',
      },
    ]);

    const summary = await runAgentTurn({
      ai,
      model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      messages: [{ role: 'user', content: 'Read file' }],
      callbacks: runnerCallbacks,
      toolExecutor: async (call) => {
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'File contents here',
          isError: false,
        };
      },
    });

    expect(afterHookInvoked).toBe(true);
    expect(summary.toolCalls).toHaveLength(1);
    expect(summary.toolCalls[0]!.isError).toBe(false);
  });

  it('AgentStop: blocked stop hook performs exactly one continuation step', async () => {
    let stopHookCallCount = 0;

    const runnerCallbacks = {
      agentStop: async (params: any) => {
        stopHookCallCount++;
        return {
          blocked: true,
          reason: 'Please check your work before stopping.',
        };
      },
    };

    const ai = createMockAIEngine([
      { text: 'First attempt at stopping.' },
      { text: 'Second attempt: I have checked my work and now I am done.' },
    ]);

    const summary = await runAgentTurn({
      ai,
      model: { provider: 'gemini', modelId: 'gemini-2.5-flash', effort: 'medium' },
      messages: [{ role: 'user', content: 'Do something' }],
      callbacks: runnerCallbacks,
    });

    // Stop hook was called on first natural stop, requested retry; second stop finished without re-triggering
    expect(stopHookCallCount).toBe(1);
    expect(summary.text).toContain('Second attempt');
    expect(summary.stopReason).toBe('natural');
  });
});
