import { describe, it, expect } from 'bun:test';
import { compileHooksConfig } from '@steward/plugins/hooks/config.js';

describe('@steward/plugins - Configuration & Validation', () => {
  it('should compile valid minimal configuration', () => {
    const raw = {
      version: 1,
      hooks: {
        SessionStart: [
          {
            name: 'init-hook',
            command: 'echo init',
          },
        ],
      },
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(error).toBeUndefined();
    expect(hooks).toHaveLength(1);
    expect(hooks[0]!.name).toBe('init-hook');
    expect(hooks[0]!.event).toBe('SessionStart');
    expect(hooks[0]!.command).toBe('echo init');
    expect(hooks[0]!.timeoutMs).toBe(5000);
    expect(hooks[0]!.enabled).toBe(true);
    expect(hooks[0]!.allTools).toBe(true);
  });

  it('should recognize all six lifecycle events', () => {
    const raw = {
      version: 1,
      hooks: {
        SessionStart: [{ name: 'h1', command: 'cmd1' }],
        UserPromptSubmit: [{ name: 'h2', command: 'cmd2' }],
        BeforeToolUse: [{ name: 'h3', command: 'cmd3', matcher: 'bash' }],
        AfterToolUse: [{ name: 'h4', command: 'cmd4', matcher: 'write_file' }],
        ToolUseFailure: [{ name: 'h5', command: 'cmd5', matcher: 'read_file' }],
        AgentStop: [{ name: 'h6', command: 'cmd6' }],
      },
    };

    const { hooks, error } = compileHooksConfig(raw, 'user');
    expect(error).toBeUndefined();
    expect(hooks).toHaveLength(6);
  });

  it('should reject invalid version number', () => {
    const raw = {
      version: 2,
      hooks: {},
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(hooks).toHaveLength(0);
    expect(error).toContain('version');
  });

  it('should reject unknown top-level keys (strictness)', () => {
    const raw = {
      version: 1,
      unknownKey: true,
      hooks: {},
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(hooks).toHaveLength(0);
    expect(error).toBeDefined();
  });

  it('should reject unknown hook fields (strictness)', () => {
    const raw = {
      version: 1,
      hooks: {
        BeforeToolUse: [
          {
            name: 'my-hook',
            command: 'echo test',
            shell: '/bin/bash', // illegal field
          },
        ],
      },
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(hooks).toHaveLength(0);
    expect(error).toBeDefined();
  });

  it('should reject matcher on UserPromptSubmit', () => {
    const raw = {
      version: 1,
      hooks: {
        UserPromptSubmit: [
          {
            name: 'bad-matcher',
            command: 'echo 1',
            matcher: 'prompt',
          },
        ],
      },
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(hooks).toHaveLength(0);
    expect(error).toContain('UserPromptSubmit');
  });

  it('should reject matcher on AgentStop', () => {
    const raw = {
      version: 1,
      hooks: {
        AgentStop: [
          {
            name: 'bad-stop',
            command: 'echo 1',
            matcher: 'stop',
          },
        ],
      },
    };

    const { hooks, error } = compileHooksConfig(raw, 'project');
    expect(hooks).toHaveLength(0);
    expect(error).toContain('AgentStop');
  });

  it('should validate timeoutMs bounds (100ms - 30000ms)', () => {
    const rawTooSmall = {
      version: 1,
      hooks: {
        BeforeToolUse: [{ name: 'fast', command: 'cmd', timeoutMs: 50 }],
      },
    };
    const resSmall = compileHooksConfig(rawTooSmall, 'project');
    expect(resSmall.error).toBeDefined();

    const rawTooLarge = {
      version: 1,
      hooks: {
        BeforeToolUse: [{ name: 'slow', command: 'cmd', timeoutMs: 60000 }],
      },
    };
    const resLarge = compileHooksConfig(rawTooLarge, 'project');
    expect(resLarge.error).toBeDefined();

    const rawValid = {
      version: 1,
      hooks: {
        BeforeToolUse: [{ name: 'valid', command: 'cmd', timeoutMs: 10000 }],
      },
    };
    const resValid = compileHooksConfig(rawValid, 'project');
    expect(resValid.error).toBeUndefined();
    expect(resValid.hooks[0]!.timeoutMs).toBe(10000);
  });
});
