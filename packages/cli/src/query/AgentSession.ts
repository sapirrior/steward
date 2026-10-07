import type { AI, Message, ModelSelection, ReasoningEffort, TokenUsage } from '@steward/ai';
import {
  createSession,
  getCurrentDateString,
  recordSessionTurn,
  renameSession,
  saveSession,
  SessionLogWriter,
  chooseTurnStatusVerb,
  type SessionData,
} from '../services/session/index.js';
import type { MutationCheckpointTracker } from '../services/checkpoint/tracker.js';
import { ShellTaskManager } from '../services/tasks/manager.js';
import { logError } from '../services/errors/logger.js';
import { runQueryTurn } from './QueryEngine.js';
import type { SessionConfig, SubmitPromptOptions, TurnSummary } from './types.js';
import { prepareTurn } from './turnContext.js';

export const SAFETY_STEP_CEILING = 50;
export const DEFAULT_MODEL: ModelSelection = {
  provider: 'google',
  modelId: 'gemini-2.5-flash',
  effort: 'medium',
};

export function accumulateTokenUsage(current: TokenUsage, delta?: TokenUsage): TokenUsage {
  if (!delta) return { ...current };
  const input = (current.input ?? 0) + (delta.input ?? 0);
  const output = (current.output ?? 0) + (delta.output ?? 0);
  const total = (current.total ?? 0) + (delta.total ?? input + output);
  return {
    input,
    output,
    total,
    reasoning:
      delta.reasoning !== undefined
        ? (current.reasoning ?? 0) + delta.reasoning
        : current.reasoning,
    cacheRead:
      delta.cacheRead !== undefined
        ? (current.cacheRead ?? 0) + delta.cacheRead
        : current.cacheRead,
    cacheWrite:
      delta.cacheWrite !== undefined
        ? (current.cacheWrite ?? 0) + delta.cacheWrite
        : current.cacheWrite,
  };
}

export interface AgentSessionDeps {
  ai: AI;
}

export class AgentSession {
  private readonly ai: AI;
  private config: SessionConfig;
  private messages: Message[] = [];
  private sessionData: SessionData;
  private sessionLogWriter?: SessionLogWriter;
  private accumulatedUsage: TokenUsage = {
    input: 0,
    output: 0,
    total: 0,
    reasoning: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };
  private activeAbortController: AbortController | null = null;
  private isGenerating = false;
  private shellTasks: ShellTaskManager = new ShellTaskManager();

  constructor(
    initialConfig: Partial<SessionConfig> | undefined,
    existingSession: SessionData | undefined,
    deps: AgentSessionDeps,
  ) {
    this.ai = deps.ai;

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
      const provider = initialConfig?.provider ?? DEFAULT_MODEL.provider;
      const modelId = initialConfig?.modelId ?? DEFAULT_MODEL.modelId;
      const effort = initialConfig?.reasoningEffort ?? DEFAULT_MODEL.effort ?? 'medium';

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

  public static resume(sessionData: SessionData, deps: AgentSessionDeps): AgentSession {
    return new AgentSession(undefined, sessionData, deps);
  }

  public get session(): SessionData {
    return this.sessionData;
  }

  public get aiClient(): AI {
    return this.ai;
  }

  public setModel(selection: ModelSelection): ModelSelection {
    this.config.provider = selection.provider;
    this.config.modelId = selection.modelId;
    this.config.reasoningEffort = selection.effort ?? 'medium';

    this.sessionData.model = { ...selection };
    this.sessionData.updatedAt = new Date().toISOString();
    saveSession(this.sessionData);

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

  public setEffort(effort: ReasoningEffort): ReasoningEffort {
    this.config.reasoningEffort = effort;
    this.sessionData.model.effort = effort;
    this.sessionData.updatedAt = new Date().toISOString();
    saveSession(this.sessionData);

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

    try {
      summary = await runQueryTurn({
        ai: this.ai,
        model: this.getModel(),
        messages: this.messages,
        instructions: prep.instructions,
        tools: prep.activeTools,
        toolContext: prep.toolContext,
        maxSteps: this.config.maxSteps,
        temperature: this.config.temperature,
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

      let turnStatus: 'complete' | 'interrupted' | 'errored' = 'complete';
      if (summary.stopReason === 'aborted') {
        turnStatus = 'interrupted';
      } else if (summary.stopReason === 'error') {
        turnStatus = 'errored';
      }

      await this.finalizeTurn({
        turnId: prep.turnId,
        turnStartMonotonic: prep.turnStartMonotonic,
        userMessage: prep.userMessage,
        responseMessages,
        summary,
        status: turnStatus,
        tracker: prep.tracker,
        error: summary.error,
        errorMessage: summary.error?.message,
      });

      return summary;
    } catch (err) {
      logError(err, {
        sessionId: this.sessionData.id,
        model: this.getModel(),
        hasPartialSummary: Boolean(summary),
      });

      const responseMessages: Message[] = summary?.rawMessages ?? [];
      const errMessage = err instanceof Error ? err.message : String(err);
      await this.finalizeTurn({
        turnId: prep.turnId,
        turnStartMonotonic: prep.turnStartMonotonic,
        userMessage: prep.userMessage,
        responseMessages,
        summary,
        status: summary?.stopReason === 'aborted' ? 'interrupted' : 'errored',
        tracker: prep.tracker,
        errorMessage: errMessage,
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
    error?: import('@steward/ai').PortError;
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
      error,
      errorMessage,
    } = params;

    const statusVerb = chooseTurnStatusVerb();
    const turnFinishedAt = summary?.finishedAt ?? new Date().toISOString();
    const turnDurationMs =
      summary?.durationMs ?? Math.max(0, Math.round(performance.now() - turnStartMonotonic));

    if (summary) {
      this.accumulatedUsage = accumulateTokenUsage(this.accumulatedUsage, summary.usage);
      summary.statusVerb = statusVerb;
    }

    const turnMessages: Message[] = [userMessage, ...responseMessages];
    const usage: TokenUsage = summary ? summary.usage : { input: 0, output: 0, total: 0 };

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
      error: error
        ? {
            code: error.code,
            status: error.status,
            provider: error.provider,
            message: error.message,
            providerType: error.providerType,
          }
        : undefined,
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
      input: 0,
      output: 0,
      total: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
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
