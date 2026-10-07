import { describe, it, expect, mock, beforeEach } from 'bun:test';
import {
  AgentSession,
  runQueryTurn,
  executeToolCall,
  prepareTurn,
  translateAgentEventToLogEvent,
  accumulateTokenUsage,
  SAFETY_STEP_CEILING,
  DEFAULT_MODEL,
} from '../src/query/index.js';
import type {
  AI,
  Message,
  ModelSelection,
  ModelStream,
  StreamEvent,
  StreamResult,
  TokenUsage,
} from '@steward/ai';
import { ToolCatalog } from '../src/tools/catalog.js';
import { z } from 'zod';
import type { ToolContext, ToolDefinition } from '../src/tools/types.js';

function createMockAI(
  streamGenerator: (messages: Message[]) => AsyncGenerator<StreamEvent, StreamResult, unknown>,
): AI {
  return {
    stream: (req: any): ModelStream => {
      const gen = streamGenerator(req.messages);
      let streamResult: StreamResult = {
        message: { role: 'assistant', content: [] },
        usage: { input: 0, output: 0, total: 0 },
        finishReason: 'stop',
      };

      const asyncIterable: ModelStream = {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              const res = await gen.next();
              if (res.done) {
                if (res.value) {
                  streamResult = res.value as StreamResult;
                }
                return { done: true, value: undefined };
              }
              return { done: false, value: res.value };
            },
          };
        },
        result: async () => streamResult,
      };

      return asyncIterable;
    },
  } as unknown as AI;
}

describe('Query Module Audit & Characterization', () => {
  describe('accumulateTokenUsage', () => {
    it('accumulates usage correctly including reasoning and cache', () => {
      const current: TokenUsage = {
        input: 100,
        output: 50,
        total: 150,
        reasoning: 20,
        cacheRead: 10,
        cacheWrite: 5,
      };
      const delta: TokenUsage = {
        input: 50,
        output: 25,
        total: 75,
        reasoning: 10,
        cacheRead: 5,
        cacheWrite: 2,
      };

      const result = accumulateTokenUsage(current, delta);
      expect(result.input).toBe(150);
      expect(result.output).toBe(75);
      expect(result.total).toBe(225);
      expect(result.reasoning).toBe(30);
      expect(result.cacheRead).toBe(15);
      expect(result.cacheWrite).toBe(7);
    });

    it('returns copy if delta is undefined', () => {
      const current: TokenUsage = { input: 10, output: 20, total: 30 };
      expect(accumulateTokenUsage(current, undefined)).toEqual(current);
    });
  });

  describe('executeToolCall', () => {
    it('executes a tool successfully and records metrics', async () => {
      const catalog = new ToolCatalog();
      const sampleTool: ToolDefinition<any, any> = {
        name: 'echo',
        displayName: 'Echo',
        access: 'read',
        description: 'Echoes text',
        parameters: z.object({ text: z.string() }),
        confirmationPolicy: 'never',
        execute: async (args) => `Echo: ${args.text}`,
      };
      catalog.register(sampleTool);

      const context: ToolContext = {
        cwd: '/test',
        mode: 'normal',
      };

      const result = await executeToolCall(
        {
          type: 'tool-call',
          id: 'call-1',
          name: 'echo',
          arguments: { text: 'hello' },
        },
        context,
        catalog,
      );

      expect(result.id).toBe('call-1');
      expect(result.name).toBe('echo');
      expect(result.isError).toBe(false);
      expect(result.result).toBe('Echo: hello');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.startedAt).toBeDefined();
      expect(result.finishedAt).toBeDefined();
    });

    it('catches tool execution errors gracefully', async () => {
      const catalog = new ToolCatalog();
      const failingTool: ToolDefinition<any, any> = {
        name: 'fail',
        displayName: 'Fail',
        access: 'read',
        description: 'Always fails',
        parameters: z.object({}),
        confirmationPolicy: 'never',
        execute: async () => {
          throw new Error('Explosion!');
        },
      };
      catalog.register(failingTool);

      const context: ToolContext = { cwd: '/test', mode: 'normal' };

      const result = await executeToolCall(
        {
          type: 'tool-call',
          id: 'call-2',
          name: 'fail',
          arguments: {},
        },
        context,
        catalog,
      );

      expect(result.id).toBe('call-2');
      expect(result.isError).toBe(true);
      expect(result.result).toBe('Explosion!');
    });
  });

  describe('translateAgentEventToLogEvent', () => {
    it('translates tool-call event to tool-start log event', () => {
      const logEvent = translateAgentEventToLogEvent(
        {
          type: 'tool-call',
          toolCall: {
            id: 'call-1',
            name: 'bash',
            args: { command: 'ls' },
          },
        },
        { sessionId: 'sess-1', turnId: 'turn-1' },
      );

      expect(logEvent).not.toBeNull();
      expect(logEvent?.type).toBe('tool-start');
      expect((logEvent as any).toolCallId).toBe('call-1');
      expect((logEvent as any).toolName).toBe('bash');
    });

    it('translates tool-result event to tool-end log event', () => {
      const logEvent = translateAgentEventToLogEvent(
        {
          type: 'tool-result',
          toolResult: {
            id: 'call-1',
            name: 'bash',
            args: { command: 'ls' },
            result: { stdout: 'file.txt', exitCode: 0 },
            isError: false,
            durationMs: 42,
          },
        },
        { sessionId: 'sess-1', turnId: 'turn-1' },
      );

      expect(logEvent).not.toBeNull();
      expect(logEvent?.type).toBe('tool-end');
      expect((logEvent as any).toolCallId).toBe('call-1');
      expect((logEvent as any).status).toBe('completed');
    });

    it('returns null for text-delta events', () => {
      const logEvent = translateAgentEventToLogEvent(
        { type: 'text-delta', text: 'hi' },
        { sessionId: 'sess-1', turnId: 'turn-1' },
      );
      expect(logEvent).toBeNull();
    });
  });

  describe('QueryEngine (runQueryTurn)', () => {
    it('executes a single-step streaming turn successfully', async () => {
      const ai = createMockAI(async function* () {
        yield { type: 'text-delta', delta: 'Hello ' };
        yield { type: 'text-delta', delta: 'world!' };
        return {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello world!' }],
          },
          usage: { input: 10, output: 5, total: 15 },
          finishReason: 'stop',
        };
      });

      const events: any[] = [];
      const summary = await runQueryTurn({
        ai,
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        toolContext: { cwd: '/test', mode: 'normal' },
        onEvent: (e) => events.push(e),
      });

      expect(summary.text).toBe('Hello world!');
      expect(summary.finishReason).toBe('stop');
      expect(summary.stopReason).toBe('natural');
      expect(events.some((e) => e.type === 'text-delta' && e.text === 'Hello ')).toBe(true);
      expect(events.some((e) => e.type === 'turn-complete')).toBe(true);
    });
  });

  describe('AgentSession', () => {
    it('initializes default config and model correctly', () => {
      const ai = createMockAI(async function* () {
        return {
          message: { role: 'assistant', content: [] },
          usage: { input: 0, output: 0, total: 0 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      expect(session.getModel()).toEqual(DEFAULT_MODEL);
      expect(session.getEffort()).toBe('medium');
      expect(session.isBusy).toBe(false);
      expect(session.getHistory()).toEqual([]);
    });

    it('submits a prompt and updates history and usage', async () => {
      const ai = createMockAI(async function* () {
        yield { type: 'text-delta', delta: 'Response from model' };
        return {
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Response from model' }],
          },
          usage: { input: 20, output: 10, total: 30 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      const summary = await session.submitPrompt('Explain TS');

      expect(summary.text).toBe('Response from model');
      const history = session.getHistory();
      expect(history.length).toBe(2);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');
      expect(session.getUsage().total).toBe(30);
    });

    it('prevents concurrent prompt submission while busy', async () => {
      let resolveStream: () => void;
      const streamBlocked = new Promise<void>((r) => {
        resolveStream = r;
      });

      const ai = createMockAI(async function* () {
        await streamBlocked;
        return {
          message: { role: 'assistant', content: [] },
          usage: { input: 0, output: 0, total: 0 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      const p1 = session.submitPrompt('Prompt 1');

      expect(session.isBusy).toBe(true);
      await expect(session.submitPrompt('Prompt 2')).rejects.toThrow(
        'Agent is already processing a turn.',
      );

      resolveStream!();
      await p1;
      expect(session.isBusy).toBe(false);
    });

    it('supports setting model and effort tier', () => {
      const ai = createMockAI(async function* () {
        return {
          message: { role: 'assistant', content: [] },
          usage: { input: 0, output: 0, total: 0 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      session.setModel({
        provider: 'anthropic',
        modelId: 'claude-3-7-sonnet',
        effort: 'high',
      });

      expect(session.getModel().provider).toBe('anthropic');
      expect(session.getModel().modelId).toBe('claude-3-7-sonnet');
      expect(session.getEffort()).toBe('high');

      session.setEffort('low');
      expect(session.getEffort()).toBe('low');
    });

    it('renames session and rejects empty names', () => {
      const ai = createMockAI(async function* () {
        return {
          message: { role: 'assistant', content: [] },
          usage: { input: 0, output: 0, total: 0 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      expect(session.renameSession('New Name')).toBe('New Name');
      expect(session.session.name).toBe('New Name');
      expect(() => session.renameSession('   ')).toThrow('Session name cannot be empty.');
    });

    it('handles abort correctly during execution', async () => {
      let abortedSignal: AbortSignal | undefined;
      const ai: AI = {
        stream: (req: any): ModelStream => {
          abortedSignal = req.abortSignal;
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: 'text-delta', delta: 'Partial...' };
              while (!req.abortSignal?.aborted) {
                await new Promise((r) => setTimeout(r, 10));
              }
            },
            result: async () => ({
              message: { role: 'assistant', content: [{ type: 'text', text: 'Partial...' }] },
              usage: { input: 5, output: 2, total: 7 },
              finishReason: 'abort',
              error: { name: 'AbortError', message: 'Turn aborted', code: 'aborted' },
            }),
          };
        },
      } as unknown as AI;

      const session = new AgentSession(undefined, undefined, { ai });
      const promptPromise = session.submitPrompt('Start work');

      // Let it start
      await new Promise((r) => setTimeout(r, 20));
      expect(session.isBusy).toBe(true);

      session.abort();
      const summary = await promptPromise;

      expect(session.isBusy).toBe(false);
      expect(summary.stopReason).toBe('aborted');
      const turns = session.session.turns;
      expect(turns.length).toBe(1);
      expect(turns[0]?.status).toBe('interrupted');
    });

    it('resets session properly', async () => {
      const ai = createMockAI(async function* () {
        return {
          message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
          usage: { input: 10, output: 10, total: 20 },
          finishReason: 'stop',
        };
      });

      const session = new AgentSession(undefined, undefined, { ai });
      await session.submitPrompt('Hi');
      expect(session.getHistory().length).toBe(2);
      expect(session.getUsage().total).toBe(20);

      await session.resetSession();
      expect(session.getHistory().length).toBe(0);
      expect(session.getUsage().total).toBe(0);
    });
  });
});
