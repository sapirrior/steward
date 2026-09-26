/**
 * @steward/plugins - Hook Runtime Engine
 */

import {
  MAX_AGENT_STOP_CONTINUATIONS,
  type AggregateHookResult,
  type BeforeToolUsePayload,
  type CompiledHook,
  type HookEventName,
  type HookEventPayload,
  type HookExecutionDiagnostic,
  type SessionStartPayload,
  type SessionStartSource,
  type UserPromptSubmitPayload,
  type AfterToolUsePayload,
  type ToolUseFailurePayload,
  type AgentStopPayload,
} from './types.js';
import { hasHooksForEvent, matchesHook } from './match.js';
import { executeHook } from './execute.js';
import { getUserHooksPath, getProjectHooksPath, loadHooksConfigFile } from './config.js';
import { createConfigHealthBuiltin } from '../builtins/index.js';

export interface HookRuntimeOptions {
  hooks?: CompiledHook[];
  isTrusted?: boolean;
}

export interface LoadHookRuntimeOptions {
  projectDir: string;
  isTrusted: boolean;
  userHooksPath?: string;
  projectHooksPath?: string;
  pluginHooks?: CompiledHook[];
  builtins?: CompiledHook[];
}

export class HookRuntime {
  private readonly hooks: readonly CompiledHook[];
  private readonly isTrusted: boolean;
  private pendingSessionContext: string[] = [];
  private stopHookContinuationsUsed = 0;

  constructor(options: HookRuntimeOptions = {}) {
    this.isTrusted = options.isTrusted ?? false;
    this.hooks = Object.freeze([...(options.hooks ?? [])]);
  }

  /**
   * Factory method to discover, validate, and compile hooks across all sources
   * respecting the strict source ordering: builtin -> user -> project -> plugin.
   */
  public static load(options: LoadHookRuntimeOptions): HookRuntime {
    const {
      projectDir,
      isTrusted,
      userHooksPath = getUserHooksPath(),
      projectHooksPath = getProjectHooksPath(projectDir),
      pluginHooks = [],
      builtins = [],
    } = options;

    const configErrors: Array<{ source: string; error: string }> = [];
    const orderedHooks: CompiledHook[] = [];

    // 1. Built-in source
    for (const b of builtins) {
      orderedHooks.push(b);
    }

    // If workspace is not trusted, external hooks (user, project, plugin) are disabled
    if (isTrusted) {
      // 2. User hooks (~/.steward/hooks.json)
      const userRes = loadHooksConfigFile(userHooksPath, 'user');
      if (userRes.error) {
        configErrors.push({ source: `User: ${userHooksPath}`, error: userRes.error });
      } else {
        for (const h of userRes.hooks) {
          orderedHooks.push(h);
        }
      }

      // 3. Project hooks (.steward/hooks.json)
      const projRes = loadHooksConfigFile(projectHooksPath, 'project');
      if (projRes.error) {
        configErrors.push({ source: `Project: ${projectHooksPath}`, error: projRes.error });
      } else {
        for (const h of projRes.hooks) {
          orderedHooks.push(h);
        }
      }

      // 4. Packaged plugin hooks
      for (const p of pluginHooks) {
        orderedHooks.push(p);
      }
    }

    // Add HookConfigHealth built-in if there are diagnostics or to track health
    const healthBuiltin = createConfigHealthBuiltin({
      configErrors,
      loadedHooksCount: orderedHooks.length,
    });
    orderedHooks.unshift(healthBuiltin);

    return new HookRuntime({
      hooks: orderedHooks,
      isTrusted,
    });
  }

  public get compiledHooks(): readonly CompiledHook[] {
    return this.hooks;
  }

  public get trusted(): boolean {
    return this.isTrusted;
  }

  /**
   * Fast-path check: returns true if there is at least one enabled hook matching the event.
   */
  public hasHooksForEvent(event: HookEventName): boolean {
    return hasHooksForEvent(this.hooks, event);
  }

  /**
   * Context buffer accumulated from SessionStart hooks.
   */
  public getPendingSessionContext(): string[] {
    return [...this.pendingSessionContext];
  }

  /**
   * Retrieves and drains pending session-start context to be applied to first model call.
   */
  public consumePendingSessionContext(): string[] {
    const ctx = [...this.pendingSessionContext];
    this.pendingSessionContext = [];
    return ctx;
  }

  /**
   * Checks if an AgentStop continuation can be performed for the current turn.
   */
  public canContinueAgentStop(): boolean {
    return this.stopHookContinuationsUsed < MAX_AGENT_STOP_CONTINUATIONS;
  }

  /**
   * Records that an AgentStop continuation has been used for the current turn.
   */
  public recordAgentStopContinuation(): void {
    this.stopHookContinuationsUsed++;
  }

  /**
   * Resets turn-level continuation counter at turn start.
   */
  public resetTurnContinuationState(): void {
    this.stopHookContinuationsUsed = 0;
  }

  /**
   * Core lifecycle execution engine: finds matching hooks in deterministic order,
   * runs them sequentially, and aggregates blocks, context, and diagnostics.
   */
  public async executeLifecycle(
    payload: HookEventPayload,
    abortSignal?: AbortSignal,
  ): Promise<AggregateHookResult> {
    if (!this.hasHooksForEvent(payload.hook_event_name)) {
      return {
        blocked: false,
        context: [],
        errors: [],
      };
    }

    const matchingHooks = this.hooks.filter((h) => matchesHook(h, payload));
    if (matchingHooks.length === 0) {
      return {
        blocked: false,
        context: [],
        errors: [],
      };
    }

    let blocked = false;
    let firstBlockReason: string | undefined;
    const contextList: string[] = [];
    const errorDiagnostics: HookExecutionDiagnostic[] = [];

    for (const hook of matchingHooks) {
      if (abortSignal?.aborted) {
        break;
      }

      const execResult = await executeHook({
        hook,
        payload,
        abortSignal,
      });

      if (execResult.diagnostic) {
        errorDiagnostics.push(execResult.diagnostic);
      }

      if (execResult.result) {
        if (execResult.result.decision === 'block') {
          blocked = true;
          if (!firstBlockReason) {
            firstBlockReason =
              execResult.result.reason || `Hook "${hook.name}" blocked the action.`;
          }
        }

        if (execResult.result.additionalContext && execResult.result.additionalContext.trim()) {
          contextList.push(execResult.result.additionalContext.trim());
        }
      }
    }

    return {
      blocked,
      firstBlockReason,
      context: contextList,
      errors: errorDiagnostics,
    };
  }

  public async runSessionStart(params: {
    sessionId: string;
    projectDir: string;
    cwd: string;
    source: SessionStartSource;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    const payload: SessionStartPayload = {
      hook_event_name: 'SessionStart',
      session_id: params.sessionId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      source: params.source,
    };

    const result = await this.executeLifecycle(payload, params.abortSignal);
    if (result.context.length > 0) {
      this.pendingSessionContext.push(...result.context);
    }
    return result;
  }

  public async runUserPromptSubmit(params: {
    sessionId: string;
    turnId: string;
    projectDir: string;
    cwd: string;
    prompt: string;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    this.resetTurnContinuationState();
    const payload: UserPromptSubmitPayload = {
      hook_event_name: 'UserPromptSubmit',
      session_id: params.sessionId,
      turn_id: params.turnId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      prompt: params.prompt,
    };
    return this.executeLifecycle(payload, params.abortSignal);
  }

  public async runBeforeToolUse(params: {
    sessionId: string;
    turnId: string;
    projectDir: string;
    cwd: string;
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    const payload: BeforeToolUsePayload = {
      hook_event_name: 'BeforeToolUse',
      session_id: params.sessionId,
      turn_id: params.turnId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      tool_call_id: params.toolCallId,
      tool_name: params.toolName,
      tool_input: params.toolInput,
    };
    return this.executeLifecycle(payload, params.abortSignal);
  }

  public async runAfterToolUse(params: {
    sessionId: string;
    turnId: string;
    projectDir: string;
    cwd: string;
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    toolOutput: unknown;
    isError: boolean;
    durationMs: number;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    const payload: AfterToolUsePayload = {
      hook_event_name: 'AfterToolUse',
      session_id: params.sessionId,
      turn_id: params.turnId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      tool_call_id: params.toolCallId,
      tool_name: params.toolName,
      tool_input: params.toolInput,
      tool_output: params.toolOutput,
      is_error: params.isError,
      duration_ms: params.durationMs,
    };
    return this.executeLifecycle(payload, params.abortSignal);
  }

  public async runToolUseFailure(params: {
    sessionId: string;
    turnId: string;
    projectDir: string;
    cwd: string;
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    error: string;
    durationMs: number;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    const payload: ToolUseFailurePayload = {
      hook_event_name: 'ToolUseFailure',
      session_id: params.sessionId,
      turn_id: params.turnId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      tool_call_id: params.toolCallId,
      tool_name: params.toolName,
      tool_input: params.toolInput,
      error: params.error,
      duration_ms: params.durationMs,
    };
    return this.executeLifecycle(payload, params.abortSignal);
  }

  public async runAgentStop(params: {
    sessionId: string;
    turnId: string;
    projectDir: string;
    cwd: string;
    stopReason: string;
    finishReason: string;
    assistantText: string;
    stopHookActive: boolean;
    abortSignal?: AbortSignal;
  }): Promise<AggregateHookResult> {
    const payload: AgentStopPayload = {
      hook_event_name: 'AgentStop',
      session_id: params.sessionId,
      turn_id: params.turnId,
      project_dir: params.projectDir,
      cwd: params.cwd,
      stop_reason: params.stopReason,
      finish_reason: params.finishReason,
      assistant_text: params.assistantText,
      stop_hook_active: params.stopHookActive,
    };
    return this.executeLifecycle(payload, params.abortSignal);
  }
}
