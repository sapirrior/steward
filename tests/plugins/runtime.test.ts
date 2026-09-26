import { describe, it, expect } from 'bun:test';
import { HookRuntime } from '@steward/plugins/hooks/runtime.js';
import type { CompiledHook } from '@steward/plugins/hooks/types.js';

describe('@steward/plugins - Hook Runtime Engine & Aggregation', () => {
  it('should execute multiple matching hooks sequentially and preserve declaration order', async () => {
    const executionOrder: string[] = [];

    const hook1: CompiledHook = {
      source: 'builtin',
      event: 'SessionStart',
      name: 'b1',
      command: 'builtin',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => {
        executionOrder.push('builtin');
        return { additionalContext: 'ctx-builtin' };
      },
    };

    const hook2: CompiledHook = {
      source: 'user',
      event: 'SessionStart',
      name: 'u1',
      command: 'user',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => {
        executionOrder.push('user');
        return { additionalContext: 'ctx-user' };
      },
    };

    const hook3: CompiledHook = {
      source: 'project',
      event: 'SessionStart',
      name: 'p1',
      command: 'project',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => {
        executionOrder.push('project');
        return { additionalContext: 'ctx-project' };
      },
    };

    const runtime = new HookRuntime({
      hooks: [hook1, hook2, hook3],
      isTrusted: true,
    });

    const res = await runtime.runSessionStart({
      sessionId: 's1',
      projectDir: '/repo',
      cwd: '/repo',
      source: 'startup',
    });

    expect(executionOrder).toEqual(['builtin', 'user', 'project']);
    expect(res.context).toEqual(['ctx-builtin', 'ctx-user', 'ctx-project']);
    expect(runtime.getPendingSessionContext()).toEqual(['ctx-builtin', 'ctx-user', 'ctx-project']);

    const consumed = runtime.consumePendingSessionContext();
    expect(consumed).toEqual(['ctx-builtin', 'ctx-user', 'ctx-project']);
    expect(runtime.getPendingSessionContext()).toEqual([]);
  });

  it('should aggregate all hooks even if an earlier hook blocks', async () => {
    const executed: string[] = [];

    const hookBlock: CompiledHook = {
      source: 'user',
      event: 'BeforeToolUse',
      name: 'policy-block',
      command: 'cmd',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => {
        executed.push('blocker');
        return { decision: 'block', reason: 'Blocked by user policy' };
      },
    };

    const hookAudit: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'audit-log',
      command: 'cmd',
      timeoutMs: 1000,
      enabled: true,
      allTools: true,
      builtinHandler: () => {
        executed.push('auditor');
        return { additionalContext: 'Audit record created' };
      },
    };

    const runtime = new HookRuntime({
      hooks: [hookBlock, hookAudit],
      isTrusted: true,
    });

    const res = await runtime.runBeforeToolUse({
      sessionId: 's1',
      turnId: 't1',
      projectDir: '/repo',
      cwd: '/repo',
      toolCallId: 'c1',
      toolName: 'bash',
      toolInput: {},
    });

    expect(executed).toEqual(['blocker', 'auditor']);
    expect(res.blocked).toBe(true);
    expect(res.firstBlockReason).toBe('Blocked by user policy');
    expect(res.context).toEqual(['Audit record created']);
  });

  it('should manage AgentStop continuation budget (max 1)', () => {
    const runtime = new HookRuntime();
    expect(runtime.canContinueAgentStop()).toBe(true);

    runtime.recordAgentStopContinuation();
    expect(runtime.canContinueAgentStop()).toBe(false);

    runtime.resetTurnContinuationState();
    expect(runtime.canContinueAgentStop()).toBe(true);
  });
});
