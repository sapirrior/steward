import { describe, it, expect } from 'bun:test';
import { compileMatcher, matchesHook, hasHooksForEvent } from '@steward/plugins/hooks/match.js';
import type {
  CompiledHook,
  BeforeToolUsePayload,
  SessionStartPayload,
} from '@steward/plugins/hooks/types.js';

describe('@steward/plugins - Matcher Precompilation and Evaluation', () => {
  it('should compile wildcard matchers (* and omitted)', () => {
    const star = compileMatcher('BeforeToolUse', '*');
    expect(star.allTools).toBe(true);

    const omitted = compileMatcher('BeforeToolUse', undefined);
    expect(omitted.allTools).toBe(true);

    const empty = compileMatcher('BeforeToolUse', '   ');
    expect(empty.allTools).toBe(true);
  });

  it('should compile single and pipe-separated matchers', () => {
    const single = compileMatcher('BeforeToolUse', 'bash');
    expect(single.allTools).toBe(false);
    expect(single.matcherSet?.has('bash')).toBe(true);
    expect(single.matcherSet?.size).toBe(1);

    const multi = compileMatcher('BeforeToolUse', 'write_file|edit_file|bash');
    expect(multi.allTools).toBe(false);
    expect(multi.matcherSet?.has('write_file')).toBe(true);
    expect(multi.matcherSet?.has('edit_file')).toBe(true);
    expect(multi.matcherSet?.has('bash')).toBe(true);
    expect(multi.matcherSet?.has('read_file')).toBe(false);
  });

  it('should evaluate tool matches correctly', () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'bash-guard',
      command: 'exit 0',
      timeoutMs: 5000,
      enabled: true,
      allTools: false,
      matcherSet: new Set(['bash', 'write_file']),
    };

    const bashPayload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: '/repo',
      cwd: '/repo',
      tool_call_id: 'c1',
      tool_name: 'bash',
      tool_input: { command: 'ls' },
    };

    const readFilePayload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: '/repo',
      cwd: '/repo',
      tool_call_id: 'c2',
      tool_name: 'read_file',
      tool_input: { file_path: 'a.txt' },
    };

    expect(matchesHook(hook, bashPayload)).toBe(true);
    expect(matchesHook(hook, readFilePayload)).toBe(false);
  });

  it('should evaluate SessionStart source matchers', () => {
    const hook: CompiledHook = {
      source: 'project',
      event: 'SessionStart',
      name: 'startup-only',
      command: 'exit 0',
      timeoutMs: 5000,
      enabled: true,
      allTools: false,
      matcherSet: new Set(['startup']),
    };

    const startupPayload: SessionStartPayload = {
      hook_event_name: 'SessionStart',
      session_id: 's1',
      project_dir: '/repo',
      cwd: '/repo',
      source: 'startup',
    };

    const resumePayload: SessionStartPayload = {
      hook_event_name: 'SessionStart',
      session_id: 's1',
      project_dir: '/repo',
      cwd: '/repo',
      source: 'resume',
    };

    expect(matchesHook(hook, startupPayload)).toBe(true);
    expect(matchesHook(hook, resumePayload)).toBe(false);
  });

  it('should respect disabled hooks', () => {
    const disabledHook: CompiledHook = {
      source: 'project',
      event: 'BeforeToolUse',
      name: 'disabled-hook',
      command: 'exit 0',
      timeoutMs: 5000,
      enabled: false,
      allTools: true,
    };

    const payload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: 's1',
      turn_id: 't1',
      project_dir: '/repo',
      cwd: '/repo',
      tool_call_id: 'c1',
      tool_name: 'bash',
      tool_input: {},
    };

    expect(matchesHook(disabledHook, payload)).toBe(false);
    expect(hasHooksForEvent([disabledHook], 'BeforeToolUse')).toBe(false);
  });
});
