/**
 * @steward/plugins - Built-in Hooks
 */

import type {
  CompiledHook,
  HookEventPayload,
  HookResult,
  SessionStartPayload,
} from '../hooks/types.js';

export interface BuiltinConfigHealthOptions {
  configErrors?: Array<{ source: string; error: string }>;
  loadedHooksCount?: number;
}

/**
 * Creates the HookConfigHealth built-in hook for SessionStart.
 */
export function createConfigHealthBuiltin(options: BuiltinConfigHealthOptions = {}): CompiledHook {
  return {
    source: 'builtin',
    event: 'SessionStart',
    name: 'HookConfigHealth',
    command: 'builtin:hook-config-health',
    allTools: true,
    timeoutMs: 1000,
    enabled: true,
    description: 'Surfaces hook configuration health and loaded hook counts on session start.',
    builtinHandler: (payload: HookEventPayload): HookResult => {
      const startPayload = payload as SessionStartPayload;
      if (options.configErrors && options.configErrors.length > 0) {
        const errorLines = options.configErrors.map((e) => `- [${e.source}] ${e.error}`).join('\n');
        return {
          additionalContext: `[Hook Configuration Diagnostics]\nThe following hook configuration warnings were encountered during ${startPayload.source}:\n${errorLines}`,
        };
      }
      return {};
    },
  };
}
