import type { ModelRef, ModelMetadata } from '@steward/models';
import { createModels } from '@steward/models';
import type { ReasoningEffort } from '../../agent/types.js';
import type { StewardSettings } from '../../settings/settingsTypes.js';
import { settingsStore } from '../../settings/settingsStore.js';
import { themeManager } from '../../themes/themeManager.js';
import { AgentRunner } from '../../agent/AgentRunner.js';
import { buildSystemPrompt } from '../../services/context/systemPrompt.js';
import { toolRegistry } from '../../tools/ToolRegistry.js';
import { ThreadController } from '../../threads/ThreadController.js';
import { PromptComposer } from '../../threads/PromptComposer.js';
import { threadToTurns } from '../../threads/threadToTurns.js';
import { commandRegistry } from '../commands/CommandRegistry.js';
import type {
  AppState,
  AppStateAction,
  ActiveToolCallState,
  PermissionRequestState,
} from '../types.js';

export type Dispatch<A> = (action: A) => void;

export interface AppControllerOptions {
  state: AppState;
  dispatch: Dispatch<AppStateAction>;
  exitFn: () => void;
}

export class AppController {
  private state: AppState;
  private dispatch: Dispatch<AppStateAction>;
  private exitFn: () => void;

  public readonly threadController: ThreadController;
  public readonly promptComposer: PromptComposer;
  private readonly runner: AgentRunner;
  private abortController: AbortController | null = null;
  private activeDialogState: string | null = null;
  private dialogSelectedIndex = 0;
  private modelsList: readonly ModelMetadata[] = [];

  constructor(options: AppControllerOptions) {
    this.state = options.state;
    this.dispatch = options.dispatch;
    this.exitFn = options.exitFn;

    this.threadController = new ThreadController({ cwd: this.state.cwd });
    this.promptComposer = new PromptComposer();
    this.runner = new AgentRunner();
  }

  public update(state: AppState, dispatch: Dispatch<AppStateAction>): void {
    this.state = state;
    this.dispatch = dispatch;
  }

  public get activeDialog(): string | null {
    return this.activeDialogState;
  }

  public get selectedIndex(): number {
    return this.dialogSelectedIndex;
  }

  public setSelectedIndex(idx: number): void {
    this.dialogSelectedIndex = idx;
  }

  public openDialog(dialogId: string): void {
    this.activeDialogState = dialogId;
    this.dialogSelectedIndex = 0;
  }

  public closeDialog(): void {
    this.activeDialogState = null;
    this.dialogSelectedIndex = 0;
  }

  public async loadInitialModels(): Promise<readonly ModelMetadata[]> {
    try {
      this.modelsList = await createModels().list({ textCapable: true });
      return this.modelsList;
    } catch {
      return [];
    }
  }

  public get cachedModels(): readonly ModelMetadata[] {
    return this.modelsList;
  }

  public async executePrompt(inputText: string): Promise<void> {
    const trimmed = inputText.trim();
    if (!trimmed || this.state.status === 'running') return;

    // 1. Slash commands routing
    if (trimmed.startsWith('/')) {
      const outcome = await commandRegistry.execute(trimmed, {
        threadController: this.threadController,
        settings: this.state.settings,
        theme: this.state.theme,
        openDialog: (id) => this.openDialog(id),
        closeDialog: () => this.closeDialog(),
        exitApp: () => this.exitApp(),
      });

      if (outcome.type === 'open-dialog') {
        this.openDialog(outcome.dialogId);
      } else if (outcome.type === 'error') {
        this.dispatch({
          type: 'START_TURN',
          turn: {
            id: `cmd-${Date.now()}`,
            userPrompt: trimmed,
            userTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reasoning: '',
            text: `Error: ${outcome.message}`,
            toolCalls: [],
            status: 'error',
          },
        });
      }
      return;
    }

    // 2. Normal prompt execution
    this.closeDialog();
    const turnId = `turn-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    this.abortController = new AbortController();

    this.dispatch({
      type: 'START_TURN',
      turn: {
        id: turnId,
        userPrompt: trimmed,
        userTimestamp: timestamp,
        reasoning: '',
        text: '',
        toolCalls: [],
        status: 'running',
        abortController: this.abortController,
      },
    });

    const threadDoc = this.threadController.currentThread;
    const systemPrompt = buildSystemPrompt({
      cwd: this.state.cwd,
      isHeadless: false,
    });

    const messages = this.promptComposer.compose({
      history: threadDoc.messages,
      systemPrompt,
      newUserPrompt: trimmed,
    });

    let reasoningStart = Date.now();
    let hasFinishedReasoning = false;

    try {
      const stream = this.runner.runStream(
        {
          modelRef: this.state.modelRef,
          messages,
          tools: toolRegistry,
          reasoning: this.state.reasoningEffort,
          systemPrompt,
          cwd: this.state.cwd,
          threadId: threadDoc.id,
          signal: this.abortController.signal,
          askPermission: async (req: any) => {
            return new Promise<boolean>((resolve) => {
              this.dispatch({
                type: 'SET_PERMISSION_REQUEST',
                request: {
                  toolName: req.toolName || 'bash',
                  command: req.command,
                  tagline: req.explanation || req.reason || 'Command requires approval',
                  resolve: (approved: boolean) => {
                    this.dispatch({ type: 'SET_PERMISSION_REQUEST', request: null });
                    resolve(approved);
                  },
                },
              });
            });
          },
        },
        (event) => {
          if (event.type === 'tool-call-start') {
            if (!hasFinishedReasoning && reasoningStart) {
              hasFinishedReasoning = true;
              this.dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
            }
            const tcState: ActiveToolCallState = {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              tagline: event.tagline,
              args: event.args,
              status: 'running',
            };
            this.dispatch({ type: 'START_TOOL_CALL', toolCall: tcState });
          } else if (event.type === 'tool-call-result') {
            this.dispatch({
              type: 'FINISH_TOOL_CALL',
              toolCallId: event.toolCallId,
              result: event.result,
              durationMs: event.durationMs,
              isError: event.isError,
            });
          } else if (event.type === 'retry') {
            this.dispatch({
              type: 'SET_RETRY',
              attempt: event.attempt,
              maxRetries: event.maxRetries,
              delayMs: event.delayMs,
              errorMessage: event.error.message,
            });
          } else if (event.type === 'error') {
            this.dispatch({ type: 'ERROR_TURN', message: event.error.message });
          }
        },
      );

      for await (const event of stream) {
        if (event.type === 'reasoning-delta') {
          this.dispatch({ type: 'APPEND_REASONING', text: event.text });
        } else if (event.type === 'text-delta') {
          if (!hasFinishedReasoning) {
            hasFinishedReasoning = true;
            this.dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
          }
          this.dispatch({ type: 'APPEND_TEXT', text: event.text });
        }
      }

      const finalResult = await stream.next();
      const finalVal = finalResult.value as any;
      this.dispatch({ type: 'FINISH_TURN', usage: finalVal?.usage });

      if (finalVal) {
        // Record and save thread atomically
        await this.threadController.recordTurn({
          userPrompt: trimmed,
          responseMessages: finalVal.responseMessages || [],
          usageDelta: finalVal.usage,
        });
      }
    } catch (err: any) {
      if (this.abortController?.signal.aborted) {
        this.dispatch({ type: 'ABORT_TURN' });
      } else {
        this.dispatch({ type: 'ERROR_TURN', message: err?.message || String(err) });
      }
    } finally {
      this.abortController = null;
    }
  }

  public abortTurn(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.dispatch({ type: 'ABORT_TURN' });
    }
    if (this.state.permissionRequest) {
      this.state.permissionRequest.resolve(false);
      this.dispatch({ type: 'SET_PERMISSION_REQUEST', request: null });
    }
  }

  public approvePermission(): void {
    if (this.state.permissionRequest) {
      this.state.permissionRequest.resolve(true);
      this.dispatch({ type: 'SET_PERMISSION_REQUEST', request: null });
    }
  }

  public denyPermission(): void {
    if (this.state.permissionRequest) {
      this.state.permissionRequest.resolve(false);
      this.dispatch({ type: 'SET_PERMISSION_REQUEST', request: null });
    }
  }

  public async switchModel(modelRef: ModelRef): Promise<void> {
    this.dispatch({ type: 'SET_MODEL', modelRef });
    this.closeDialog();
    await settingsStore.update({
      provider: modelRef.provider,
      model: modelRef.modelId,
    }).catch(() => {});
  }

  public async switchEffort(effort: ReasoningEffort): Promise<void> {
    this.dispatch({ type: 'SET_EFFORT', effort });
    this.closeDialog();
    await settingsStore.update({ reasoningEffort: effort }).catch(() => {});
  }

  public async switchTheme(themeName: string): Promise<void> {
    const nextTheme = themeManager.getTheme(themeName);
    themeManager.setTheme(themeName);
    this.dispatch({ type: 'SET_THEME', theme: nextTheme });
    this.closeDialog();
    await settingsStore.update({ theme: themeName }).catch(() => {});
  }

  public async resumeThread(threadId: string): Promise<void> {
    const doc = await this.threadController.resume(threadId);
    if (doc) {
      const turns = threadToTurns(doc.messages);
      this.dispatch({
        type: 'LOAD_THREAD',
        history: turns,
        modelRef: doc.model,
        metrics: doc.usage,
        threadDoc: doc,
      });
    }
    this.closeDialog();
  }

  public async newSession(): Promise<void> {
    await this.threadController.newSession();
    this.dispatch({ type: 'NEW_SESSION' });
    this.closeDialog();
  }

  public async exitApp(): Promise<void> {
    await this.threadController.save().catch(() => {});
    if (this.state.permissionRequest) {
      this.state.permissionRequest.resolve(false);
    }
    this.exitFn();
  }
}
