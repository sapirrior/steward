import type { ModelRef, ModelMetadata } from '@steward/models';
import { createModels } from '@steward/models';
import type { ReasoningEffort } from '@steward/sdk';
import { createStewardSDK } from '@steward/sdk';
import type { StewardSettings } from '../../settings/settingsTypes.js';
import { settingsStore } from '../../settings/settingsStore.js';
import { themeManager } from '../../themes/themeManager.js';
import { buildSystemPrompt } from '../../services/context/systemPrompt.js';
import { toolRegistry } from '../../tools/ToolRegistry.js';
import { ThreadController } from '../../threads/ThreadController.js';
import { PromptComposer } from '../../threads/PromptComposer.js';
import { threadToTurns } from '../../threads/threadToTurns.js';
import { commandRegistry } from '../commands/CommandRegistry.js';
import { adaptToolsToAiSdk } from '../../tools/aiSdkToolAdapter.js';
import { resolveCliCredentials } from '../../services/providerCredentials.js';
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
  private readonly sdk = createStewardSDK();
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
  }

  public update(state: AppState, dispatch: Dispatch<AppStateAction>): void {
    this.state = state;
    this.dispatch = dispatch;
  }

  public exitApp(): void {
    this.exitFn();
  }

  public get activeDialog(): string | null {
    return this.activeDialogState;
  }

  public get selectedIndex(): number {
    return this.dialogSelectedIndex;
  }

  public get models(): readonly ModelMetadata[] {
    return this.modelsList;
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

  public async initialize(): Promise<void> {
    await this.loadInitialModels();

    // Load active thread turns into UI
    const doc = this.threadController.currentThread;
    const turns = threadToTurns(doc.messages);
    this.dispatch({ type: 'SET_TURNS', turns });
  }

  public openDialog(dialogId: string): void {
    this.activeDialogState = dialogId;
    this.dialogSelectedIndex = 0;
  }

  public closeDialog(): void {
    this.activeDialogState = null;
    this.dialogSelectedIndex = 0;
  }

  public setSelectedIndex(idx: number): void {
    this.dialogSelectedIndex = Math.max(0, idx);
  }

  public async executePrompt(promptText: string): Promise<void> {
    const trimmed = promptText.trim();
    if (!trimmed) return;

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

    const tools = adaptToolsToAiSdk(toolRegistry, {
      cwd: this.state.cwd,
      threadId: threadDoc.id,
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
    });

    const keyMetadata = await resolveCliCredentials(this.state.modelRef.provider, {
      signal: this.abortController.signal,
    });

    let reasoningStart = Date.now();
    let hasFinishedReasoning = false;
    const toolStartTimes = new Map<string, number>();

    try {
      const modelIdentifier = `${this.state.modelRef.provider}/${this.state.modelRef.modelId}`;
      const stream = this.sdk.stream({
        model: modelIdentifier,
        instructions: systemPrompt,
        messages: threadDoc.messages, // prior history only
        message: trimmed, // new user prompt
        tools,
        reasoning: this.state.reasoningEffort,
        signal: this.abortController.signal,
        keyMetadata,
      });

      for await (const event of stream) {
        switch (event.type) {
          case 'reasoning-delta':
            this.dispatch({ type: 'APPEND_REASONING', text: event.text });
            break;

          case 'text-delta':
            if (!hasFinishedReasoning) {
              hasFinishedReasoning = true;
              this.dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
            }
            this.dispatch({ type: 'APPEND_TEXT', text: event.text });
            break;

          case 'tool-call': {
            if (!hasFinishedReasoning && reasoningStart) {
              hasFinishedReasoning = true;
              this.dispatch({ type: 'FINISH_REASONING', durationMs: Date.now() - reasoningStart });
            }
            toolStartTimes.set(event.toolCallId, Date.now());
            const tcState: ActiveToolCallState = {
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              tagline: `${event.toolName} executing...`,
              args: event.input,
              status: 'running',
            };
            this.dispatch({ type: 'START_TOOL_CALL', toolCall: tcState });
            break;
          }

          case 'tool-result': {
            const start = toolStartTimes.get(event.toolCallId);
            const durationMs = start ? Date.now() - start : 0;
            this.dispatch({
              type: 'FINISH_TOOL_CALL',
              toolCallId: event.toolCallId,
              result: event.output,
              durationMs,
              isError: event.isError,
            });
            break;
          }

          case 'retry':
            this.dispatch({
              type: 'SET_RETRY',
              attempt: event.attempt,
              maxRetries: event.maxRetries,
              delayMs: event.elapsedDelayMs,
              errorMessage: event.error.message,
            });
            break;

          case 'finish': {
            const usageDelta = {
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              totalTokens: event.usage.totalTokens,
              reasoningTokens: event.usage.reasoningTokens,
              cacheReadTokens: event.usage.cacheReadTokens,
              cacheWriteTokens: event.usage.cacheWriteTokens,
            };
            this.dispatch({ type: 'FINISH_TURN', usage: usageDelta });

            // Record and save thread atomically
            await this.threadController.recordTurn({
              userPrompt: trimmed,
              responseMessages: (event.responseMessages as any) || [],
              usageDelta,
            });
            break;
          }

          case 'error':
            this.dispatch({ type: 'ERROR_TURN', message: event.error.message });
            break;

          case 'aborted':
            this.dispatch({ type: 'ABORT_TURN' });
            break;
        }
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
    const turns = threadToTurns(doc.messages);
    this.dispatch({ type: 'SET_TURNS', turns });
    this.closeDialog();
  }

  public async newThread(): Promise<void> {
    await this.threadController.newThread(this.state.modelRef);
    this.dispatch({ type: 'CLEAR_TURNS' });
    this.closeDialog();
  }
}
