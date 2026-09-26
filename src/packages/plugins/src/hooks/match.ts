/**
 * @steward/plugins - Hook Matcher Precompilation and Evaluation
 */

import type {
  CompiledHook,
  HookEventName,
  HookEventPayload,
  SessionStartPayload,
  BeforeToolUsePayload,
  AfterToolUsePayload,
  ToolUseFailurePayload,
} from './types.js';

export const EVENTS_SUPPORTING_MATCHER: readonly HookEventName[] = [
  'SessionStart',
  'BeforeToolUse',
  'AfterToolUse',
  'ToolUseFailure',
] as const;

export function supportsMatcher(event: HookEventName): boolean {
  return EVENTS_SUPPORTING_MATCHER.includes(event);
}

/**
 * Precompiles a raw matcher string into matching metadata on a compiled hook.
 */
export function compileMatcher(
  event: HookEventName,
  rawMatcher?: string,
): { allTools?: boolean; matcherSet?: Set<string> } {
  if (!supportsMatcher(event)) {
    return {};
  }

  const trimmed = rawMatcher?.trim();
  if (!trimmed || trimmed === '*') {
    return { allTools: true };
  }

  const parts = trimmed
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0 || parts.includes('*')) {
    return { allTools: true };
  }

  return {
    allTools: false,
    matcherSet: new Set(parts),
  };
}

/**
 * Fast-path predicate to check if there are any enabled hooks for an event.
 */
export function hasHooksForEvent(hooks: readonly CompiledHook[], event: HookEventName): boolean {
  for (let i = 0; i < hooks.length; i++) {
    const h = hooks[i]!;
    if (h.enabled && h.event === event) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a compiled hook matches a specific lifecycle payload.
 */
export function matchesHook(hook: CompiledHook, payload: HookEventPayload): boolean {
  if (!hook.enabled || hook.event !== payload.hook_event_name) {
    return false;
  }

  switch (payload.hook_event_name) {
    case 'SessionStart': {
      if (hook.allTools || !hook.matcherSet || hook.matcherSet.size === 0) {
        return true;
      }
      return hook.matcherSet.has((payload as SessionStartPayload).source);
    }

    case 'BeforeToolUse':
    case 'AfterToolUse':
    case 'ToolUseFailure': {
      if (hook.allTools || !hook.matcherSet || hook.matcherSet.size === 0) {
        return true;
      }
      const toolName = (
        payload as BeforeToolUsePayload | AfterToolUsePayload | ToolUseFailurePayload
      ).tool_name;
      return hook.matcherSet.has(toolName);
    }

    case 'UserPromptSubmit':
    case 'AgentStop':
      return true;

    default:
      return false;
  }
}
