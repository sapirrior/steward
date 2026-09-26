import { describe, it, expect } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { HookRuntime } from '@steward/plugins/hooks/runtime.js';
import { AgentSession } from '@steward/agents/engine/agent-session.js';
import { runAgentTurn } from '@steward/agents/engine/agent-runner.js';
import type { AIEngine, InferenceRequest, InferenceStreamResult, StreamEvent } from '@steward/ai';

function createScriptableAIEngine(
  steps: Array<{
    text?: string;
    toolCalls?: Array<{ id: string; name: string; arguments: any }>;
  }>,
): AIEngine {
  let stepIdx = 0;

  return {
    auth: {} as any,
    stream(request: InferenceRequest) {
      const current = steps[stepIdx] ?? { text: 'Done' };
      stepIdx++;

      const events: StreamEvent[] = [];
      if (current.text) {
        events.push({ type: 'text-delta', delta: current.text });
      }

      if (current.toolCalls) {
        for (const tc of current.toolCalls) {
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
            ...(current.text ? [{ type: 'text' as const, text: current.text }] : []),
            ...(current.toolCalls
              ? current.toolCalls.map((tc) => ({
                  type: 'tool_call' as const,
                  id: tc.id,
                  name: tc.name,
                  arguments: tc.arguments,
                }))
              : []),
          ],
        },
        finishReason: current.toolCalls && current.toolCalls.length > 0 ? 'tool_calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
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

describe('@steward/plugins - Hardcore Multi-Source & Stress Scenarios', () => {
  const baseDir = join(tmpdir(), 'steward-hardcore-test-' + Date.now());
  const userConfigDir = join(baseDir, 'user-settings');
  const projectDir = join(baseDir, 'project-workspace');

  mkdirSync(userConfigDir, { recursive: true });
  mkdirSync(join(projectDir, '.steward'), { recursive: true });

  it('Hardcore 1: Same hook names across User, Project, and Builtin sources with exact execution order', async () => {
    const sideEffectOrder: string[] = [];

    const userHooksPath = join(userConfigDir, 'hooks.json');
    const projectHooksPath = join(projectDir, '.steward', 'hooks.json');

    // User hook config with name "audit-guard"
    writeFileSync(
      userHooksPath,
      JSON.stringify({
        version: 1,
        hooks: {
          BeforeToolUse: [
            {
              name: 'audit-guard',
              command:
                'node -e "process.stdout.write(JSON.stringify({ additionalContext: \'User context\' }))"',
              matcher: 'bash',
            },
          ],
        },
      }),
      'utf-8',
    );

    // Project hook config ALSO with name "audit-guard"
    writeFileSync(
      projectHooksPath,
      JSON.stringify({
        version: 1,
        hooks: {
          BeforeToolUse: [
            {
              name: 'audit-guard',
              command:
                'node -e "process.stdout.write(JSON.stringify({ additionalContext: \'Project context\' }))"',
              matcher: 'bash',
            },
          ],
        },
      }),
      'utf-8',
    );

    const runtime = HookRuntime.load({
      projectDir,
      isTrusted: true,
      userHooksPath,
      projectHooksPath,
      builtins: [
        {
          source: 'builtin',
          event: 'BeforeToolUse',
          name: 'audit-guard',
          command: 'builtin',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            sideEffectOrder.push('builtin:audit-guard');
            return { additionalContext: 'Builtin context' };
          },
        },
      ],
    });

    // Verify all 3 distinct hooks exist despite having the same name
    const toolHooks = runtime.compiledHooks.filter((h) => h.event === 'BeforeToolUse');
    expect(toolHooks).toHaveLength(3);
    expect(toolHooks[0]!.source).toBe('builtin');
    expect(toolHooks[1]!.source).toBe('user');
    expect(toolHooks[2]!.source).toBe('project');

    const res = await runtime.runBeforeToolUse({
      sessionId: 's1',
      turnId: 't1',
      projectDir,
      cwd: projectDir,
      toolCallId: 'call_1',
      toolName: 'bash',
      toolInput: { command: 'ls' },
    });

    expect(res.blocked).toBe(false);
    expect(res.context).toEqual(['Builtin context', 'User context', 'Project context']);
  });

  it('Hardcore 2: 5 sequential hooks for the same event in one file with middle block & trailing execution', async () => {
    const executedHookOrder: number[] = [];

    const hooksPath = join(projectDir, '.steward', 'hooks-5.json');
    const runtime = new HookRuntime({
      hooks: [
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'hook-1',
          command: 'h1',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            executedHookOrder.push(1);
            return { additionalContext: 'ctx-1' };
          },
        },
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'hook-2',
          command: 'h2',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            executedHookOrder.push(2);
            return { additionalContext: 'ctx-2' };
          },
        },
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'hook-3-blocker',
          command: 'h3',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            executedHookOrder.push(3);
            return { decision: 'block', reason: 'Blocked by hook 3' };
          },
        },
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'hook-4',
          command: 'h4',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            executedHookOrder.push(4);
            return { additionalContext: 'ctx-4' };
          },
        },
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'hook-5',
          command: 'h5',
          allTools: true,
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: () => {
            executedHookOrder.push(5);
            return { additionalContext: 'ctx-5' };
          },
        },
      ],
      isTrusted: true,
    });

    const res = await runtime.runBeforeToolUse({
      sessionId: 's1',
      turnId: 't1',
      projectDir,
      cwd: projectDir,
      toolCallId: 'call_1',
      toolName: 'write_file',
      toolInput: {},
    });

    // All 5 must execute in exact array order for deterministic auditing
    expect(executedHookOrder).toEqual([1, 2, 3, 4, 5]);
    expect(res.blocked).toBe(true);
    expect(res.firstBlockReason).toBe('Blocked by hook 3');
    expect(res.context).toEqual(['ctx-1', 'ctx-2', 'ctx-4', 'ctx-5']);
  });

  it('Hardcore 3: Multi-tool step with partial matcher filtering and runner state preservation', async () => {
    const executedForTools: string[] = [];

    const runtime = new HookRuntime({
      hooks: [
        {
          source: 'project',
          event: 'BeforeToolUse',
          name: 'bash-only-guard',
          command: 'bash-guard',
          allTools: false,
          matcherSet: new Set(['bash']),
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: (payload) => {
            executedForTools.push(`before:bash:${(payload as any).tool_call_id}`);
            return { decision: 'block', reason: 'Disallowed bash command' };
          },
        },
        {
          source: 'project',
          event: 'AfterToolUse',
          name: 'read-only-audit',
          command: 'read-audit',
          allTools: false,
          matcherSet: new Set(['read_file']),
          timeoutMs: 1000,
          enabled: true,
          builtinHandler: (payload) => {
            executedForTools.push(`after:read_file:${(payload as any).tool_call_id}`);
            return { additionalContext: 'File contents validated' };
          },
        },
      ],
      isTrusted: true,
    });

    const ai = createScriptableAIEngine([
      {
        text: 'Executing multiple tools in one turn',
        toolCalls: [
          { id: 'c1', name: 'read_file', arguments: { path: 'a.txt' } },
          { id: 'c2', name: 'bash', arguments: { command: 'rm -rf /' } },
          { id: 'c3', name: 'read_file', arguments: { path: 'b.txt' } },
        ],
      },
      {
        text: 'Final response after mixed tool execution',
      },
    ]);

    writeFileSync(join(projectDir, 'a.txt'), 'Content of A', 'utf-8');
    writeFileSync(join(projectDir, 'b.txt'), 'Content of B', 'utf-8');

    const session = new AgentSession(undefined, undefined, { ai, hookRuntime: runtime });

    const summary = await session.submitPrompt('Perform multi-action check', { cwd: projectDir });

    expect(summary.toolCalls).toHaveLength(3);
    // Tool 1: read_file (succeeded)
    expect(summary.toolCalls[0]!.id).toBe('c1');
    expect(summary.toolCalls[0]!.isError).toBe(false);

    // Tool 2: bash (blocked by BeforeToolUse hook)
    expect(summary.toolCalls[1]!.id).toBe('c2');
    expect(summary.toolCalls[1]!.isError).toBe(true);
    expect(String(summary.toolCalls[1]!.result)).toContain('Disallowed bash command');

    // Tool 3: read_file (succeeded)
    expect(summary.toolCalls[2]!.id).toBe('c3');
    expect(summary.toolCalls[2]!.isError).toBe(false);

    expect(executedForTools).toEqual([
      'after:read_file:c1',
      'before:bash:c2',
      'after:read_file:c3',
    ]);
  });
});
