/**
 * @steward/agents - AgentSession Implementation
 */

import type {
  AIEngine,
  Message,
  ModelSelection,
  ReasoningEffort,
  TokenUsage,
  ToolCallContent,
} from '@steward/ai';
import { createAIEngine } from '@steward/ai';
import {
  createSession,
  getCurrentDateString,
  recordSessionTurn,
  renameSession,
  saveSession,
  SessionLogWriter,
  chooseTurnStatusVerb,
  type SessionData,
  type SessionLogEvent,
} from '@steward/services/session/index.js';
import type { MutationCheckpointTracker } from '@steward/services/checkpoint/index.js';
import { defaultToolCatalog, summarizeToolResult, formatPlainToolSummary } from '../tools/index.js';
import { ShellTaskManager } from '@steward/services/tasks/manager.js';
import { loadSettings, saveSettings } from '@steward/services/config/index.js';
import { logError } from '@steward/services/errors/index.js';
import { runAgentTurn } from './agent-runner.js';
import { SAFETY_STEP_CEILING } from './constants.js';
import type { AgentEvent } from './events.js';
import type { SessionConfig, SubmitPromptOptions, ToolResultInfo, TurnSummary } from './types.js';
import { prepareTurn } from './turn-context.js';

export { SubmitPromptOptions };

/**
 * Pure helper to translate agent events into presentation journal log events.
 */
export function translateAgentEventToLogEvent(
  event: AgentEvent,
  context: { sessionId: string; turnId: string },
): SessionLogEvent | null {
  if (event.type === 'tool-call') {
    return {
      schemaVersion: 1,
      sessionId: context.sessionId,
      turnId: context.turnId,
      type: 'tool-start',
      timestamp: new Date().toISOString(),
      toolCallId: event.toolCall.id,
      toolName: event.toolCall.name,
      startedAt: new Date().toISOString(),
    };
  }

  if (event.type === 'tool-result') {
    const toolDef = defaultToolCatalog.get(event.toolResult.name);
    const summaryObj = summarizeToolResult(
      toolDef,
      event.toolResult.args,
      event.toolResult.result,
      event.toolResult.isError,
    );
    const outputSummary = formatPlainToolSummary(summaryObj);
    const errorMessage = event.toolResult.isError
      ? typeof event.toolResult.result === 'object' && event.toolResult.result !== null
        ? ((event.toolResult.result as any).message ?? JSON.stringify(event.toolResult.result))
        : String(event.toolResult.result)
      : undefined;
    const status = event.toolResult.isError ? 'failed' : 'completed';

    return {
      schemaVersion: 1,
      sessionId: context.sessionId,
      turnId: context.turnId,
      type: 'tool-end',
      timestamp: event.toolResult.finishedAt ?? new Date().toISOString(),
      toolCallId: event.toolResult.id,
      toolName: event.toolResult.name,
      finishedAt: event.toolResult.finishedAt ?? new Date().toISOString(),
      durationMs: event.toolResult.durationMs,
      status,
      displayName: toolDef?.displayName,
      icon: toolDef?.icon,
      outputSummary,
      errorMessage,
    };
  }

  return null;
}

/**
 * Pure helper to accumulate token usage metrics safely.
 */
export function accumulateUsage(current: TokenUsage, delta: TokenUsage): TokenUsage {
  return {
    inputTokens: current.inputTokens + delta.inputTokens,
    outputTokens: current.outputTokens + delta.outputTokens,
    totalTokens: current.totalTokens + delta.totalTokens,
    reasoningTokens:
      delta.reasoningTokens !== undefined
        ? (current.reasoningTokens ?? 0) + delta.reasoningTokens
        : current.reasoningTokens,
    cacheReadTokens:
      delta.cacheReadTokens !== undefined
        ? (current.cacheReadTokens ?? 0) + delta.cacheReadTokens
        : current.cacheReadTokens,
    cacheWriteTokens:
      delta.cacheWriteTokens !== undefined
        ? (current.cacheWriteTokens ?? 0) + delta.cacheWriteTokens
        : current.cacheWriteTokens,
  };
}

export interface AgentSessionDeps {
  ai?: AIEngine;
}

/**
 * Stateful conversation session harness managing message history,
 * active model configuration, abort controls, and turn execution.
 */
export class AgentSession {
  private readonly ai: AIEngine;
  private config: SessionConfig;
  private messages: Message[] = [];
  private sessionData: SessionData;
  private sessionLogWriter?: SessionLogWriter;
  private accumulatedUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  private activeAbortController: AbortController | null = null;
  private isGenerating = false;
  private shellTasks: ShellTaskManager = new ShellTaskManager();

  constructor(
    initialConfig?: Partial<SessionConfig>,
    existingSession?: SessionData,
    deps?: AgentSessionDeps,
  ) {
    this.ai = deps?.ai ?? createAIEngine();

    if (existingSession) {
      this.sessionData = existingSession;
      this.config = {
        provider: existingSession.model.provider,
        modelId: existingSession.model.modelId,
        reasoningEffort: existingSession.model.effort ?? 'medium',
        temperature: initialConfig?.temperature,
        maxSteps: initialConfig?.maxSteps ?? SAFETY_STEP_CEILING,
      };
      this.accumulatedUsage = { ...existingSession.totalUsage };

      for (const turn of existingSession.turns) {
        if (turn.messages && turn.messages.length > 0) {
          for (const msg of turn.messages) {
            this.messages.push(msg);
          }
        }
      }
      this.sessionLogWriter = new SessionLogWriter(
        this.sessionData.date || getCurrentDateString(),
        this.sessionData.id,
      );
    } else {
      const settings = loadSettings();
      const provider = initialConfig?.provider ?? settings.model?.provider ?? 'gemini';
      const modelId = initialConfig?.modelId ?? settings.model?.modelId ?? 'gemini-2.5-flash';
      const effort: ReasoningEffort =
        initialConfig?.reasoningEffort ?? settings.model?.effort ?? 'medium';

      const selection: ModelSelection = {
        provider,
        modelId,
        effort,
      };

      this.config = {
        provider: selection.provider,
        modelId: selection.modelId,
        reasoningEffort: selection.effort,
        temperature: initialConfig?.temperature,
        maxSteps: initialConfig?.maxSteps ?? SAFETY_STEP_CEILING,
      };
      this.sessionData = createSession(selection);
      this.sessionLogWriter = new SessionLogWriter(
        this.sessionData.date || getCurrentDateString(),
        this.sessionData.id,
      );
    }
  }

  public static resume(sessionData: SessionData, deps?: AgentSessionDeps): AgentSession {
    return new AgentSession(undefined, sessionData, deps);
  }

  public get session(): SessionData {
    return this.sessionData;
  }

  public setModel(selection: ModelSelection, persist = true): ModelSelection {
    this.config.provider = selection.provider;
    this.config.modelId = selection.modelId;
    this.config.reasoningEffort = selection.effort ?? 'medium';

    this.sessionData.model = { ...selection };
    this.sessionData.updatedAt = new Date().toISOString();
    saveSession(this.sessionData);

    if (persist) {
      saveSettings({
        model: {
          provider: selection.provider,
          modelId: selection.modelId,
          effort: selection.effort,
        },
      });
    }

    return selection;
  }

  public getModel(): ModelSelection {
    return {
      provider: this.config.provider,
      modelId: this.config.modelId,
      effort: this.config.reasoningEffort ?? 'medium',
    };
  }

  public getEffort(): ReasoningEffort {
    return this.config.reasoningEffort ?? 'medium';
  }

  public setEffort(effort: ReasoningEffort, persist = true): ReasoningEffort {
    this.config.reasoningEffort = effort;
    this.sessionData.model.effort = effort;
    this.sessionData.updatedAt = new Date().toISOString();
    saveSession(this.sessionData);

    if (persist) {
      saveSettings({
        model: {
          provider: this.config.provider,
          modelId: this.config.modelId,
          effort,
        },
      });
    }

    return effort;
  }

  public renameSession(newName: string): string {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Session name cannot be empty.');
    }
    this.sessionData.name = trimmed;
    renameSession(this.sessionData, trimmed);
    return trimmed;
  }

  public async submitPrompt(
    prompt: string,
    options: SubmitPromptOptions = {},
  ): Promise<TurnSummary> {
    if (this.isGenerating) {
      throw new Error('Agent is already processing a turn. Please wait or abort.');
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Prompt cannot be empty.');
    }

    this.isGenerating = true;

    const prep = await prepareTurn(trimmedPrompt, options, {
      sessionId: this.sessionData.id,
      shellTasks: this.shellTasks,
      sessionLogWriter: this.sessionLogWriter,
      turnNumber: this.sessionData.turns.length + 1,
      model: this.getModel(),
    });

    this.messages.push(prep.userMessage);
    this.activeAbortController = prep.abortController;

    let summary: TurnSummary | undefined;

    const toolExecutor = async (call: ToolCallContent): Promise<ToolResultInfo> => {
      const startedAt = new Date().toISOString();
      const monotonicStart = performance.now();

      try {
        const result = await defaultToolCatalog.execute(
          call.name,
          call.arguments,
          prep.toolContext,
        );
        const finishedAt = new Date().toISOString();
        const durationMs = Math.max(0, Math.round(performance.now() - monotonicStart));

        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result,
          isError: false,
          durationMs,
          startedAt,
          finishedAt,
        };
      } catch (err: any) {
        const finishedAt = new Date().toISOString();
        const durationMs = Math.max(0, Math.round(performance.now() - monotonicStart));
        const errorMsg = err instanceof Error ? err.message : String(err);

        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: errorMsg,
          isError: true,
          durationMs,
          startedAt,
          finishedAt,
        };
      }
    };

    try {
      summary = await runAgentTurn({
        ai: this.ai,
        model: this.getModel(),
        messages: this.messages,
        instructions: prep.instructions,
        tools: prep.activeTools,
        toolExecutor,
        maxSteps: this.config.maxSteps,
        temperature: this.config.temperature,
        reasoningEffort: this.config.reasoningEffort,
        abortSignal: prep.abortController.signal,
        onEvent: prep.wrappedOnEvent,
      });

      const responseMessages: Message[] = [];
      if (summary.rawMessages && summary.rawMessages.length > 0) {
        for (const msg of summary.rawMessages) {
          this.messages.push(msg);
          responseMessages.push(msg);
        }
      }

      const hasAssistantMessage = responseMessages.some((m) => m.role === 'assistant');
      if (summary.text && !hasAssistantMessage) {
        const assistantMsg: Message = {
          role: 'assistant',
          content: [{ type: 'text', text: summary.text }],
        };
        this.messages.push(assistantMsg);
        responseMessages.push(assistantMsg);
      }

      await this.finalizeTurn({
        turnId: prep.turnId,
        turnStartMonotonic: prep.turnStartMonotonic,
        userMessage: prep.userMessage,
        responseMessages,
        summary,
        status: 'complete',
        tracker: prep.tracker,
      });

      return summary;
    } catch (err) {
      logError(err, {
        sessionId: this.sessionData.id,
        model: this.getModel(),
        hasPartialSummary: Boolean(summary),
      });

      const responseMessages: Message[] = summary?.rawMessages ?? [];
      await this.finalizeTurn({
        turnId: prep.turnId,
        turnStartMonotonic: prep.turnStartMonotonic,
        userMessage: prep.userMessage,
        responseMessages,
        summary,
        status: summary ? 'interrupted' : 'errored',
        tracker: prep.tracker,
        errorMessage: err instanceof Error ? err.message : String(err),
      });

      throw err;
    } finally {
      this.isGenerating = false;
      this.activeAbortController = null;
    }
  }

  private async finalizeTurn(params: {
    turnId: string;
    turnStartMonotonic: number;
    userMessage: Message;
    responseMessages: Message[];
    summary: TurnSummary | undefined;
    status: 'complete' | 'interrupted' | 'errored';
    tracker: MutationCheckpointTracker;
    errorMessage?: string;
  }): Promise<void> {
    const {
      turnId,
      turnStartMonotonic,
      userMessage,
      responseMessages,
      summary,
      status,
      tracker,
      errorMessage,
    } = params;

    const statusVerb = chooseTurnStatusVerb();
    const turnFinishedAt = summary?.finishedAt ?? new Date().toISOString();
    const turnDurationMs =
      summary?.durationMs ?? Math.max(0, Math.round(performance.now() - turnStartMonotonic));

    if (summary) {
      this.accumulatedUsage = accumulateUsage(this.accumulatedUsage, summary.usage);
      summary.statusVerb = statusVerb;
    }

    const turnMessages: Message[] =
      status === 'errored' ? [userMessage] : [userMessage, ...responseMessages];

    const usage: TokenUsage = summary
      ? summary.usage
      : { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    recordSessionTurn(this.sessionData, {
      id: turnId,
      status,
      usage,
      messages: turnMessages,
    });

    await tracker.commitTurn(turnId, status);

    this.sessionLogWriter?.append({
      schemaVersion: 1,
      sessionId: this.sessionData.id,
      turnId,
      type: 'turn-end',
      timestamp: turnFinishedAt,
      finishedAt: turnFinishedAt,
      durationMs: turnDurationMs,
      status,
      statusVerb,
      stopReason: summary?.stopReason,
      finishReason: summary?.finishReason,
      errorMessage,
    });
  }

  public abort(): void {
    if (this.activeAbortController && this.isGenerating) {
      this.activeAbortController.abort();
    }
  }

  public get isBusy(): boolean {
    return this.isGenerating;
  }

  public getHistory(): Message[] {
    return [...this.messages];
  }

  public get tasks(): ShellTaskManager {
    return this.shellTasks;
  }

  public async shutdown(): Promise<void> {
    await this.shellTasks.shutdown();
    await this.sessionLogWriter?.close();
  }

  public async resetSession(): Promise<void> {
    await this.shellTasks.shutdown();
    await this.sessionLogWriter?.close();
    this.shellTasks = new ShellTaskManager();
    this.messages = [];
    this.accumulatedUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    this.sessionData = createSession({
      provider: this.config.provider,
      modelId: this.config.modelId,
      effort: this.config.reasoningEffort ?? 'medium',
    });
    this.sessionLogWriter = new SessionLogWriter(
      this.sessionData.date || getCurrentDateString(),
      this.sessionData.id,
    );
  }

  public getUsage(): TokenUsage {
    return { ...this.accumulatedUsage };
  }
}
