import {
  runAgentLoop,
  accumulateTokenUsage,
  type Message,
  type TokenUsage,
  type ToolResult,
  type ToolCallContent,
  type ToolSpec,
} from '@steward/agent';
import { createAI, type AI, type ReasoningEffort } from '@steward/ai';
import { SettingsStore, settingsStore } from '../settings/settingsStore.js';
import { ThreadStore, threadStore } from '../threads/threadStore.js';
import { ToolRegistry, toolRegistry } from '../tools/ToolRegistry.js';
import { buildSystemPrompt } from '../services/context/systemPrompt.js';
import { createStreamAdapter } from './streamAdapter.js';
import type { QueryEngineConfig, QueryEngineEvent, QueryTurnResult } from './types.js';
import type { ToolContext } from '../tools/Tool.js';
import type { Thread } from '../threads/threadTypes.js';

export class QueryEngine {
  private cwd: string;
  private threadId: string;
  private mutableMessages: Message[];
  private totalUsage: TokenUsage;
  private settingsStore: SettingsStore;
  private threadStore: ThreadStore;
  private toolRegistry: ToolRegistry;
  private ai: AI;
  private isHeadless: boolean;
  private customSystemPrompt?: string;
  private extraInstructions?: string;
  private maxSteps: number;
  private overrideProvider?: string;
  private overrideModel?: string;
  private overrideEffort?: ReasoningEffort;
  private askPermission?: QueryEngineConfig['askPermission'];
  private activeAbortController: AbortController | null = null;
  private initialized = false;

  constructor(config: QueryEngineConfig = {}) {
    this.cwd = config.cwd ?? process.cwd();
    this.settingsStore = config.settingsStore ?? settingsStore;
    this.threadStore = config.threadStore ?? threadStore;
    this.toolRegistry = config.toolRegistry ?? toolRegistry;
    this.ai = config.ai ?? createAI();
    this.isHeadless = Boolean(config.isHeadless);
    this.customSystemPrompt = config.customSystemPrompt;
    this.extraInstructions = config.extraInstructions;
    this.maxSteps = config.maxSteps ?? 50;
    this.overrideProvider = config.provider;
    this.overrideModel = config.model;
    this.overrideEffort = config.reasoningEffort;
    this.askPermission = config.askPermission;

    this.threadId = config.threadId ?? this.threadStore.generateId();
    this.mutableMessages = config.initialMessages ? [...config.initialMessages] : [];
    this.totalUsage = {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    };
  }

  public getThreadId(): string {
    return this.threadId;
  }

  public getMessages(): readonly Message[] {
    return this.mutableMessages;
  }

  public getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  public abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  /**
   * Loads an existing thread or initializes a new thread document in ThreadStore.
   */
  public async initSession(): Promise<Thread> {
    if (this.initialized) {
      return (await this.threadStore.load(this.threadId)) ?? this.createEmptyThread();
    }

    const existing = await this.threadStore.load(this.threadId);
    if (existing) {
      if (this.mutableMessages.length === 0 && existing.messages.length > 0) {
        this.mutableMessages = [...existing.messages];
      }
      this.totalUsage = accumulateTokenUsage(this.totalUsage, existing.totalUsage);
      this.initialized = true;
      return existing;
    }

    const newThread = this.createEmptyThread();
    await this.threadStore.save(newThread);
    this.initialized = true;
    return newThread;
  }

  private createEmptyThread(): Thread {
    return {
      id: this.threadId,
      title: 'New Thread',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      model: this.overrideModel ?? 'gemini-flash-latest',
      cwd: this.cwd,
      messages: [...this.mutableMessages],
      totalUsage: { ...this.totalUsage },
    };
  }

  /**
   * Filters and returns active tool specifications.
   * INVARIANT: In headless mode, 'bash' tool is strictly EXCLUDED.
   */
  public getActiveToolSpecs(settings: Awaited<ReturnType<SettingsStore['load']>>): ToolSpec[] {
    const specs = this.toolRegistry.getToolSpecs(settings);

    if (this.isHeadless) {
      // In headless mode, bash is NEVER available
      return specs.filter((tool) => tool.name !== 'bash');
    }

    return specs;
  }

  /**
   * Submits a user prompt, executes the multi-step agent turn loop,
   * streams real-time events, and persists the resulting thread state.
   */
  public async submitMessage(
    prompt: string,
    onEvent?: (event: QueryEngineEvent) => void,
    externalSignal?: AbortSignal,
  ): Promise<QueryTurnResult> {
    await this.initSession();

    const userMessage: Message = {
      role: 'user',
      content: prompt.trim(),
    };

    // Load active settings
    const settings = await this.settingsStore.load();
    const provider = this.overrideProvider ?? settings.provider;
    const modelId = this.overrideModel ?? settings.model;
    const effort = this.overrideEffort ?? settings.reasoningEffort;

    // Assemble system prompt with headless instructions if applicable
    const systemPromptText =
      this.customSystemPrompt ??
      buildSystemPrompt({
        cwd: this.cwd,
        extraInstructions: this.extraInstructions,
        isHeadless: this.isHeadless,
      });

    // Prepare message history with system message at index 0
    const turnInputMessages: Message[] = [];
    if (this.mutableMessages.length === 0 || this.mutableMessages[0]?.role !== 'system') {
      turnInputMessages.push({ role: 'system', content: systemPromptText });
    }
    turnInputMessages.push(...this.mutableMessages);
    turnInputMessages.push(userMessage);

    // Active tool specs (strictly excluding bash if headless)
    const activeTools = this.getActiveToolSpecs(settings);

    // Create stream function
    const streamFn = createStreamAdapter(
      this.ai,
      {
        provider,
        modelId,
        effort,
      },
      effort,
    );

    // Setup abort controller
    this.activeAbortController = new AbortController();
    const turnAbortController = this.activeAbortController;
    if (externalSignal) {
      externalSignal.addEventListener('abort', () => turnAbortController.abort(), { once: true });
    }

    // Accumulators for events
    let accumulatedText = '';
    let accumulatedReasoning = '';

    // Tool execution handler
    const executeTool = async (call: ToolCallContent, signal: AbortSignal): Promise<ToolResult> => {
      // Hard guard: bash is forbidden in headless mode
      if (this.isHeadless && call.name === 'bash') {
        return {
          id: call.id,
          name: call.name,
          args: call.arguments,
          result: 'Error: The bash tool is disabled in headless mode.',
          isError: true,
        };
      }

      const toolInstance = this.toolRegistry.getTool(call.name);
      const glyph = toolInstance?.glyph ?? '✱';
      const initialBadge = toolInstance?.formatBadge(call.arguments, {
        success: true,
        output: '',
      });

      onEvent?.({
        type: 'tool-call-start',
        id: call.id,
        name: call.name,
        args: call.arguments,
        glyph,
        badge: initialBadge,
      });

      const toolContext: ToolContext = {
        cwd: this.cwd,
        signal,
        threadId: this.threadId,
        askPermission: this.askPermission,
        onProgress: (progress) => {
          onEvent?.({
            type: 'tool-progress',
            id: call.id,
            progress,
          });
        },
      };

      const startTime = Date.now();
      const execResult = await this.toolRegistry.executeTool(call.name, call.arguments, toolContext);
      const durationMs = Date.now() - startTime;

      const finalBadge = toolInstance?.formatBadge(call.arguments, execResult) ?? execResult.badge;

      const toolResult: ToolResult = {
        id: call.id,
        name: call.name,
        args: call.arguments,
        result: execResult.output,
        isError: !execResult.success,
        durationMs,
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
      };

      onEvent?.({
        type: 'tool-call-end',
        id: call.id,
        name: call.name,
        result: toolResult,
        glyph,
        badge: finalBadge,
      });

      return toolResult;
    };

    // Execute runAgentLoop
    try {
      const agentResult = await runAgentLoop({
        messages: turnInputMessages,
        stream: streamFn,
        tools: activeTools,
        executeTool,
        maxSteps: this.maxSteps,
        effort,
        signal: turnAbortController.signal,
        onEvent: (event) => {
          switch (event.type) {
            case 'turn-start':
              onEvent?.({ type: 'turn-start', step: event.step });
              break;

            case 'message-update':
              if (event.streamEvent.type === 'text-delta') {
                accumulatedText += event.streamEvent.delta;
                onEvent?.({
                  type: 'text-delta',
                  delta: event.streamEvent.delta,
                  accumulatedText,
                });
              } else if (event.streamEvent.type === 'reasoning-delta') {
                accumulatedReasoning += event.streamEvent.delta;
                onEvent?.({
                  type: 'reasoning-delta',
                  delta: event.streamEvent.delta,
                  accumulatedReasoning,
                });
              } else if (event.streamEvent.type === 'retry') {
                onEvent?.({
                  type: 'retry',
                  attempt: event.streamEvent.attempt,
                  maxAttempts: event.streamEvent.maxAttempts,
                  delayMs: event.streamEvent.delayMs,
                  error: event.streamEvent.error,
                });
              }
              break;

            case 'turn-end':
              onEvent?.({
                type: 'turn-end',
                step: 1,
                toolResults: event.toolResults,
                usage: event.usage,
              });
              break;
          }
        },
      });

      // Update in-memory messages: keep system prompt if first turn, plus user message, plus new assistant/tool messages
      if (this.mutableMessages.length === 0) {
        this.mutableMessages.push({ role: 'system', content: systemPromptText });
      }
      this.mutableMessages.push(userMessage);
      this.mutableMessages.push(...agentResult.newMessages);

      // Accumulate token usage
      this.totalUsage = accumulateTokenUsage(this.totalUsage, agentResult.usage);

      // Persist to ThreadStore
      const updatedThread: Thread = {
        id: this.threadId,
        title: this.threadStore.generateTitle(prompt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        model: modelId,
        cwd: this.cwd,
        messages: [...this.mutableMessages],
        totalUsage: { ...this.totalUsage },
      };
      await this.threadStore.save(updatedThread);

      const turnResult: QueryTurnResult = {
        text: agentResult.text,
        reasoning: agentResult.reasoning,
        toolResults: agentResult.toolResults,
        newMessages: [userMessage, ...agentResult.newMessages],
        totalUsage: { ...this.totalUsage },
        stopReason: agentResult.stopReason,
        durationMs: agentResult.durationMs,
        error: agentResult.error ? new Error(agentResult.error.message) : undefined,
      };

      if (turnResult.error) {
        onEvent?.({ type: 'error', error: turnResult.error });
      }

      onEvent?.({ type: 'done', result: turnResult });
      return turnResult;
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      onEvent?.({ type: 'error', error });

      const failureResult: QueryTurnResult = {
        text: accumulatedText,
        reasoning: accumulatedReasoning,
        toolResults: [],
        newMessages: [userMessage],
        totalUsage: { ...this.totalUsage },
        stopReason: turnAbortController.signal.aborted ? 'aborted' : 'error',
        durationMs: 0,
        error,
      };

      return failureResult;
    } finally {
      if (this.activeAbortController === turnAbortController) {
        this.activeAbortController = null;
      }
    }
  }
}
