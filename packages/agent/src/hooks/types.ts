/**
 * @steward/plugins - Frozen Domain Contracts and Types
 */

export const HOOK_EVENT_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'BeforeToolUse',
  'AfterToolUse',
  'ToolUseFailure',
  'AgentStop',
] as const;

export type HookEventName = (typeof HOOK_EVENT_NAMES)[number];

export const HOOK_SOURCE_TYPES = ['builtin', 'user', 'project', 'plugin'] as const;
export type HookSourceType = (typeof HOOK_SOURCE_TYPES)[number];

export type SessionStartSource = 'startup' | 'resume' | 'reset';

export interface BaseHookPayload {
  hook_event_name: HookEventName;
  session_id: string;
  turn_id?: string;
  project_dir: string;
  cwd: string;
}

export interface SessionStartPayload extends BaseHookPayload {
  hook_event_name: 'SessionStart';
  source: SessionStartSource;
}

export interface UserPromptSubmitPayload extends BaseHookPayload {
  hook_event_name: 'UserPromptSubmit';
  turn_id: string;
  prompt: string;
}

export interface BeforeToolUsePayload extends BaseHookPayload {
  hook_event_name: 'BeforeToolUse';
  turn_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface AfterToolUsePayload extends BaseHookPayload {
  hook_event_name: 'AfterToolUse';
  turn_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: unknown;
  is_error: boolean;
  duration_ms: number;
}

export interface ToolUseFailurePayload extends BaseHookPayload {
  hook_event_name: 'ToolUseFailure';
  turn_id: string;
  tool_call_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  error: string;
  duration_ms: number;
}

export interface AgentStopPayload extends BaseHookPayload {
  hook_event_name: 'AgentStop';
  turn_id: string;
  stop_reason: string;
  finish_reason: string;
  assistant_text: string;
  stop_hook_active: boolean;
}

export type HookEventPayload =
  | SessionStartPayload
  | UserPromptSubmitPayload
  | BeforeToolUsePayload
  | AfterToolUsePayload
  | ToolUseFailurePayload
  | AgentStopPayload;

export interface RawHookDefinition {
  name: string;
  command: string;
  matcher?: string;
  timeoutMs?: number;
  enabled?: boolean;
  description?: string;
}

export interface RawHooksConfig {
  version: number;
  hooks?: Partial<Record<HookEventName, RawHookDefinition[]>>;
}

export interface CompiledHook {
  source: HookSourceType;
  sourcePath?: string;
  event: HookEventName;
  name: string;
  command: string;
  matcher?: string;
  allTools?: boolean;
  matcherSet?: Set<string>;
  timeoutMs: number;
  enabled: boolean;
  description?: string;
  builtinHandler?: (payload: HookEventPayload) => Promise<HookResult> | HookResult;
}

export interface HookResult {
  decision?: 'allow' | 'block';
  reason?: string;
  additionalContext?: string;
}

export interface HookExecutionDiagnostic {
  hookName: string;
  source: HookSourceType;
  event: HookEventName;
  error: string;
  exitCode?: number | null;
  stderr?: string;
}

export interface AggregateHookResult {
  blocked: boolean;
  firstBlockReason?: string;
  context: string[];
  errors: HookExecutionDiagnostic[];
}

export const DEFAULT_HOOK_TIMEOUT_MS = 5000;
export const MIN_HOOK_TIMEOUT_MS = 100;
export const MAX_HOOK_TIMEOUT_MS = 30000;

export const MAX_HOOK_INPUT_BYTES = 256 * 1024; // 256 KiB
export const MAX_HOOK_STDOUT_BYTES = 32 * 1024; // 32 KiB
export const MAX_HOOK_STDERR_BYTES = 16 * 1024; // 16 KiB
export const MAX_HOOK_CONTEXT_CHARS = 8 * 1024; // 8 KiB

export const MAX_AGENT_STOP_CONTINUATIONS = 1;
