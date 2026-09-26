import { describe, it, expect } from 'bun:test';
import { executeHook } from '@steward/plugins/hooks/execute.js';
import type {
  CompiledHook,
  UserPromptSubmitPayload,
  BeforeToolUsePayload,
} from '@steward/plugins/hooks/types.js';

describe('@steward/plugins - Hook Execution Runtime', () => {
  it('should execute command hook and parse JSON stdout allow decision', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'UserPromptSubmit',
      name: 'allow-hook',
      command: 'echo \'{"decision":"allow","additionalContext":"project is active"}\'',
      timeoutMs: 5000,
      enabled: true,
    };

    const payload: UserPromptSubmitPayload = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      prompt: 'hello world',
    };

    const res = await executeHook({ hook, payload });
    expect(res.diagnostic).toBeUndefined();
    expect(res.result?.decision).toBe('allow');
    expect(res.result?.additionalContext).toBe('project is active');
  });

  it('should execute command hook and parse JSON stdout block decision', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'block-hook',
      command: 'echo \'{"decision":"block","reason":"Disallowed by workspace policy"}\'',
      timeoutMs: 5000,
      enabled: true,
      allTools: true,
    };

    const payload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      tool_call_id: 'c1',
      tool_name: 'bash',
      tool_input: { command: 'rm -rf /' },
    };

    const res = await executeHook({ hook, payload });
    expect(res.diagnostic).toBeUndefined();
    expect(res.result?.decision).toBe('block');
    expect(res.result?.reason).toBe('Disallowed by workspace policy');
  });

  it('should handle exit code 2 as blocking failure for blocking events', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'exit2-hook',
      command: 'echo "Denied via stderr" >&2; exit 2',
      timeoutMs: 5000,
      enabled: true,
      allTools: true,
    };

    const payload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      tool_call_id: 'c1',
      tool_name: 'bash',
      tool_input: {},
    };

    const res = await executeHook({ hook, payload });
    expect(res.result?.decision).toBe('block');
    expect(res.result?.reason).toContain('Denied via stderr');
  });

  it('should treat nonzero exit code (e.g. 1) as non-blocking execution diagnostic', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'error-hook',
      command: 'echo "Syntax error" >&2; exit 1',
      timeoutMs: 5000,
      enabled: true,
      allTools: true,
    };

    const payload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      tool_call_id: 'c1',
      tool_name: 'bash',
      tool_input: {},
    };

    const res = await executeHook({ hook, payload });
    expect(res.result).toBeUndefined();
    expect(res.diagnostic?.error).toContain('Syntax error');
    expect(res.diagnostic?.exitCode).toBe(1);
  });

  it('should enforce execution timeout', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'UserPromptSubmit',
      name: 'sleep-timeout',
      command: 'sleep 5',
      timeoutMs: 200,
      enabled: true,
    };

    const payload: UserPromptSubmitPayload = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      prompt: 'test',
    };

    const start = Date.now();
    const res = await executeHook({ hook, payload });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1500);
    expect(res.diagnostic?.error).toContain('timed out');
  });

  it('should filter provider secrets from child environment', async () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'UserPromptSubmit',
      name: 'secret-check',
      command:
        'node -e "process.stdout.write(JSON.stringify({ additionalContext: String(process.env.ANTHROPIC_API_KEY || \'absent\') }))"',
      timeoutMs: 5000,
      enabled: true,
    };

    // Temporarily simulate secret in environment
    process.env.ANTHROPIC_API_KEY = 'super-secret-key';

    const payload: UserPromptSubmitPayload = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 's1',
      turn_id: 't1',
      project_dir: process.cwd(),
      cwd: process.cwd(),
      prompt: 'test',
    };

    try {
      const res = await executeHook({ hook, payload });
      expect(res.result?.additionalContext).toBe('absent');
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
