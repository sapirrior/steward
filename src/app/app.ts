import TerminalEngine from '@steward/tui/engine/TerminalEngine.js';
import { AgentSession } from '@steward/agents/engine/agent-session.js';
import { defaultCommandRegistry } from './commands/registry.js';
import { defaultToolCatalog, summarizeToolResult, summarizeToolArgs } from '@steward/agents/tools/index.js';
import type { ModelDescriptor } from '@steward/agents/models/index.js';
import type { SessionData } from '@steward/services/session/types.js';
import { listSessions, loadSession } from '@steward/services/session/index.js';
import {
  saveSettings,
  saveThemeSelection,
  isFolderTrusted,
  trustFolder,
} from '@steward/services/config/index.js';
import { setActiveTheme, getActiveThemeName, listThemes } from '@steward/tui/theme/index.js';
import Header from './ui/components/Header.js';
import StatusBar from './ui/components/StatusBar.js';
import StreamingView from './ui/components/StreamingView.js';
import PromptInput from './ui/components/PromptInput.js';
import TrustGate from './ui/components/TrustGate.js';
import ModelPicker from './ui/components/docks/ModelPicker.js';
import ThemePicker from './ui/components/docks/ThemePicker.js';
import { cycleMode } from '@steward/agents/policy/modes.js';
import { saveModeSelection } from '@steward/services/config/settings.js';
import SessionMenu from './ui/components/docks/SessionMenu.js';
import ShortcutsMenu from './ui/components/docks/ShortcutsMenu.js';

import EffortPicker from './ui/components/docks/EffortPicker.js';
import RewindMenu from './ui/components/docks/RewindMenu.js';
import BashPermissionDock from './ui/components/docks/BashPermissionDock.js';
import FilePermissionDock from './ui/components/docks/FilePermissionDock.js';
import { PermissionQueue } from './ui/utils/permission-queue.js';
import { parseKeyInput } from '@steward/tui/primitives/index.js';

import {
  executeRewind,
  recoverPendingCheckpoint,
} from '@steward/services/checkpoint/index.js';
import {
  formatSystemMessage,
  formatAssistantMessage,
  formatToolStatus,
  formatErrorBadge,
  formatTurnStatus,
} from './ui/utils/message-formatter.js';
import { renderTranscript } from './ui/utils/transcript.js';
import { classifyError } from '@steward/services/errors/index.js';
import { UpdateCheckerService } from '@steward/services/updater/index.js';

export interface TUIAppOptions {
  version?: string;
  initialSession?: AgentSession;
  cwd?: string;
  onExit?: () => void;
}

export class TUIApp {
  private engine: TerminalEngine;
  private session: AgentSession;
  private cwd: string;
  private onExitCallback?: () => void;

  private header: Header;
  private streamingView: StreamingView;
  private promptInput: PromptInput;
  private statusBar: StatusBar;

  private activeModal:
    | ModelPicker
    | ThemePicker
    | SessionMenu
    | ShortcutsMenu
    | EffortPicker
    | RewindMenu
    | BashPermissionDock
    | FilePermissionDock
    | null = null;
  private ctrlCPending = false;
  private ctrlCTimer: NodeJS.Timeout | null = null;
  private isBusy = false;
  private updateChecker: UpdateCheckerService;
  private permissionQueue: PermissionQueue;

  constructor(options: TUIAppOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.session = options.initialSession ?? new AgentSession();
    this.onExitCallback = options.onExit;
    this.engine = new TerminalEngine();

    const model = this.session.getModel();

    this.header = new Header({
      version: options.version,
      cwd: this.cwd,
      model,
    });

    this.streamingView = new StreamingView();

    this.promptInput = new PromptInput({
      onSubmit: (text) => this.handleSubmit(text),
      onAbort: () => this.handleAbort(),
      onToggleHelp: () => this.toggleHelp(),
      cwd: this.cwd,
      initialHistory: this.session.session.turns
        .map((t) => {
          const userMsg = t.messages.find((m) => m.role === 'user');
          if (!userMsg) return '';
          return typeof userMsg.content === 'string'
            ? userMsg.content
            : Array.isArray(userMsg.content)
              ? userMsg.content
                  .filter((p: any) => p.type === 'text')
                  .map((p: any) => p.text)
                  .join(' ')
              : '';
        })
        .filter((p): p is string => Boolean(p && p.trim())),
    });

    this.statusBar = new StatusBar({
      model,
      isBusy: false,
    });

    this.updateChecker = new UpdateCheckerService({
      currentVersion: options.version,
      onStatusChange: (state, info) => {
        if (state === 'idle') {
          this.statusBar.setUpdateStatus(undefined);
        } else if (state === 'available') {
          this.statusBar.setUpdateStatus(
            {
              state,
              version: info?.version,
              message: info?.message,
            },
            8000,
          );
        } else if (state === 'error') {
          this.statusBar.setUpdateStatus(
            {
              state,
              version: info?.version,
              message: info?.message,
            },
            4000,
          );
        } else {
          this.statusBar.setUpdateStatus({
            state,
            version: info?.version,
            message: info?.message,
          });
        }
      },
    });

    this.permissionQueue = new PermissionQueue({
      onShow: (item) => {
        if (this.activeModal) this.closeModal();
        this.engine.unmount(this.promptInput);
        this.engine.unmount(this.statusBar);

        if (item.kind === 'bash') {
          const dock = new BashPermissionDock({
            command: item.request.command,
            explanation: item.request.explanation,
            onDecision: (allowed) => {
              this.permissionQueue.resolveActive(allowed);
            },
          });
          this.activeModal = dock;
          this.engine.mount(dock, { kind: 'dock' });
        } else if (item.kind === 'file') {
          const dock = new FilePermissionDock({
            request: item.request,
            onDecision: (allowed) => {
              this.permissionQueue.resolveActive(allowed);
            },
          });
          this.activeModal = dock;
          this.engine.mount(dock, { kind: 'dock' });
        }
        this.engine.mount(this.statusBar);
      },
      onHide: () => {
        if (
          this.activeModal instanceof BashPermissionDock ||
          this.activeModal instanceof FilePermissionDock
        ) {
          this.closeModal();
        }
      },
    });
  }

  public async start(): Promise<void> {
    if (isFolderTrusted(this.cwd)) {
      this.proceedStart();
      return;
    }

    this.engine.ensureAlternateScreen();
    const trustGate = new TrustGate({
      cwd: this.cwd,
      onDecision: (trusted) => {
        if (trusted) {
          trustFolder(this.cwd);
          this.engine.unmount(trustGate);
          this.proceedStart();
        } else {
          this.exit();
        }
      },
    });

    this.engine.mount(trustGate, { kind: 'custom' });
  }

  private proceedStart(): void {
    this.engine.ensureAlternateScreen();

    // Rehydrate previous session turns if any, or render header
    if (this.session.session.turns.length > 0) {
      renderTranscript(this.engine, this.session.session, this.header);
    } else {
      this.engine.commit('header', this.header.render());
    }

    // Mount live interactive components at the bottom
    this.engine.mount(this.streamingView, { kind: 'custom' });
    this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
    this.engine.mount(this.statusBar, { kind: 'custom' });

    // Start background update check
    this.updateChecker.startBackgroundCheck(3000);

    // Handle global keybindings
    this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);

      // Normal Controls:
      // Ctrl+C double-tap handling
      if (action.type === 'ctrl-c') {
        if (this.ctrlCPending) {
          if (this.ctrlCTimer) clearTimeout(this.ctrlCTimer);
          this.ctrlCPending = false;
          this.exit();
          return true;
        }

        this.ctrlCPending = true;
        this.statusBar.update({ exitPending: true });
        this.ctrlCTimer = setTimeout(() => {
          this.ctrlCPending = false;
          this.statusBar.update({ exitPending: false });
        }, 1500);
        return true;
      }

      // Ctrl+B: cycle through modes when idle
      if (action.type === 'ctrl-b') {
        if (this.activeModal) return true;
        if (this.session.isBusy || this.isBusy) {
          this.statusBar.showWarning('Cannot change mode while Steward is generating');
          return true;
        }
        const newMode = cycleMode();
        saveModeSelection(newMode);
        this.statusBar.setMode(newMode);
        return true;
      }

      return false;
    });
  }

  private closeModal(): void {
    if (this.activeModal) {
      this.engine.unmount(this.activeModal);
      this.engine.unmount(this.statusBar);
      this.activeModal = null;
      this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
      this.engine.mount(this.statusBar);
    }
  }

  private toggleHelp(): void {
    if (this.activeModal instanceof ShortcutsMenu) {
      this.closeModal();
      return;
    }
    this.openHelp();
  }

  private openHelp(): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const help = new ShortcutsMenu({
      onClose: () => this.closeModal(),
    });
    this.activeModal = help;
    this.engine.mount(help, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private openModelPicker(models: ModelDescriptor[]): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const currentModel = this.session.getModel();
    const picker = new ModelPicker({
      models,
      currentModel,
      onSelect: (selected) => {
        const updated = this.session.setModel({
          provider: selected.provider,
          modelId: selected.model_id,
        });
        saveSettings({
          model: {
            provider: updated.provider,
            modelId: updated.modelId,
            effort: updated.effort,
          },
        });
        this.header.props.model = updated;
        this.statusBar.update({ model: updated });
        this.engine.commit(
          'system',
          formatSystemMessage(`Active model switched to ${selected.provider}/${selected.model_id}`),
        );
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    this.engine.mount(picker, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private openThemePicker(themes: ThemeMeta[]): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const currentTheme = getActiveThemeName();
    const picker = new ThemePicker({
      themes,
      currentTheme,
      onSelect: (selected) => {
        setActiveTheme(selected.name);
        saveThemeSelection(selected.name);
        renderTranscript(this.engine, this.session.session, this.header);
        this.engine.mount(this.streamingView);
        this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
        this.engine.mount(this.statusBar);
        this.engine.requestFrame(true);
        this.engine.commit('system', formatSystemMessage(`Theme switched to ${selected.label}.`));
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    this.engine.mount(picker, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private switchToSession(selected: SessionData): void {
    this.permissionQueue.clear();
    recoverPendingCheckpoint(this.cwd, selected.id).catch(() => {});
    this.session.shutdown().catch(() => {});
    this.session = AgentSession.resume(selected);
    const model = this.session.getModel();
    this.header.props.model = model;
    this.statusBar.update({ model });

    renderTranscript(this.engine, selected, this.header);

    this.engine.mount(this.streamingView);
    this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
    this.engine.mount(this.statusBar);
  }

  private openSessionMenu(sessions: SessionData[]): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const menu = new SessionMenu({
      sessions,
      onSelect: (selected) => {
        this.closeModal();
        this.switchToSession(selected);
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = menu;
    this.engine.mount(menu, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private openEffortPicker(): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const currentEffort = this.session.getEffort();
    const picker = new EffortPicker({
      currentEffort,
      onSelect: (selected, persist) => {
        this.session.setEffort(selected, persist);
        const updatedModel = this.session.getModel();
        this.header.props.model = updatedModel;
        this.statusBar.update({ model: updatedModel });
        const scope = persist ? 'saved globally to settings' : 'for this session only';
        this.engine.commit(
          'system',
          formatSystemMessage(`Reasoning effort set to "${selected}" (${scope})`),
        );
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    this.engine.mount(picker, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private openRewindMenu(): void {
    if (this.activeModal) this.closeModal();
    this.engine.unmount(this.promptInput);
    this.engine.unmount(this.statusBar);

    const menu = new RewindMenu({
      session: this.session.session,
      cwd: this.cwd,
      onSelect: async (item) => {
        this.closeModal();

        const res = await executeRewind({
          session: this.session.session,
          targetTurnId: item.turnId,
          workspaceRoot: this.cwd,
        });

        if (res.success) {
          this.switchToSession(res.rewoundSession);
          this.engine.commit(
            'system',
            formatSystemMessage(
              `Rewound to before turn ${item.turnIndex + 1} (${res.restoredFilesCount} file(s) restored, ${res.discardedTurnsCount} turn(s) discarded).`,
            ),
          );
        } else {
          this.engine.commit('system', formatSystemMessage(`Rewind failed: ${res.error}`));
        }
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = menu;
    this.engine.mount(menu, { kind: 'dock' });
    this.engine.mount(this.statusBar);
  }

  private handleAbort(): void {
    if (this.isBusy) {
      this.permissionQueue.clear();
      this.session.abort();
    }
  }

  private async handleSubmit(text: string): Promise<void> {
    // 1. Slash command execution (/)
    if (defaultCommandRegistry.isCommand(text)) {
      const cmdResult = await defaultCommandRegistry.execute(text, {
        session: this.session,
        cwd: this.cwd,
      });

      if (cmdResult.data?.clearHistory) {
        this.engine.clearAll();
        this.engine.commit('header', this.header.render());
        this.engine.mount(this.streamingView);
        this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
        this.engine.mount(this.statusBar);
        return;
      }

      if (cmdResult.data?.exit) {
        this.exit();
        return;
      }

      this.engine.commitPrompt(text);

      if (cmdResult.data?.showRewind) {
        this.openRewindMenu();
        return;
      }

      if (cmdResult.data?.showModelPicker) {
        this.openModelPicker(cmdResult.data.models ?? []);
        return;
      }

      if (cmdResult.data?.showThemePicker) {
        this.openThemePicker(cmdResult.data.themes ?? listThemes());
        return;
      }

      if (cmdResult.data?.themeSwitched) {
        for (const comp of this.engine.components) comp.markDirty();
        this.engine.requestFrame(true);
      }

      if (cmdResult.data?.modeSwitched && cmdResult.data?.selectedMode) {
        this.statusBar.setMode(cmdResult.data.selectedMode.name);
      }

      if (cmdResult.data?.showEffortPicker) {
        this.openEffortPicker();
        return;
      }

      if (cmdResult.data?.resumeDirect) {
        this.switchToSession(cmdResult.data.resumeDirect);
        return;
      }

      if (cmdResult.data?.showResume) {
        const summaries = listSessions();
        const loadedSessions = summaries
          .map((s) => loadSession(s.id))
          .filter((s): s is NonNullable<typeof s> => s !== null);
        this.openSessionMenu(cmdResult.data.sessions ?? loadedSessions);
        return;
      }

      if (cmdResult.message) {
        this.engine.commit('system', formatSystemMessage(cmdResult.message));
      }

      const updatedModel = this.session.getModel();
      this.header.props.model = updatedModel;
      this.statusBar.update({
        model: updatedModel,
      });
      return;
    }

    // 2. Submit user prompt to AgentSession
    this.engine.commitPrompt(text);
    this.setBusy(true);
    this.streamingView.setThinking(true);

    const turnStartTime = performance.now();
    let accumulatedText = '';
    const activeToolStartTimes = new Map<string, number>();

    try {
      await this.session.submitPrompt(text, {
        cwd: this.cwd,
        requestBashPermission: (req) => this.permissionQueue.enqueueBash(req),
        requestFilePermission: (req) => this.permissionQueue.enqueueFile(req),

        onEvent: (event) => {
          switch (event.type) {
            case 'reasoning-delta': {
              // Internal model reasoning is saved to session messages but not rendered to the TUI
              break;
            }
            case 'text-delta': {
              accumulatedText += event.text;
              this.streamingView.setStream(accumulatedText, true);
              break;
            }
            case 'tool-call': {
              // Flush any prior accumulated assistant text before tool execution log
              if (accumulatedText.trim()) {
                this.engine.commit('assistant-message', formatAssistantMessage(accumulatedText), {
                  hangingIndent: 2,
                });
                accumulatedText = '';
                this.streamingView.reset();
              }

              activeToolStartTimes.set(event.toolCall.id, performance.now());
              const toolDef = defaultToolCatalog.get(event.toolCall.name);
              this.streamingView.setActiveTool({
                id: event.toolCall.id,
                name: event.toolCall.name,
                displayName: toolDef?.displayName,
                args: event.toolCall.args,
                startTime: performance.now(),
              });
              break;
            }
            case 'tool-result': {
              this.streamingView.setActiveTool(null);
              const start = activeToolStartTimes.get(event.toolResult.id);
              const durationMs =
                event.toolResult.durationMs ??
                (start ? Math.round(performance.now() - start) : undefined);
              activeToolStartTimes.delete(event.toolResult.id);

              const toolDef = defaultToolCatalog.get(event.toolResult.name);

              const toolName = event.toolResult.name;
              const displayName = toolDef?.displayName;
              const icon = toolDef?.icon;
              const argsSummary = summarizeToolArgs(toolDef, event.toolResult.args);
              const status = event.toolResult.isError ? 'failed' : 'completed';
              const error = event.toolResult.isError
                ? typeof event.toolResult.result === 'object' && event.toolResult.result !== null
                  ? ((event.toolResult.result as any).message ??
                    JSON.stringify(event.toolResult.result))
                  : String(event.toolResult.result)
                : undefined;
              const summary = summarizeToolResult(
                toolDef,
                event.toolResult.args,
                event.toolResult.result,
                event.toolResult.isError,
              );

              this.engine.commit(
                'tool-result',
                (w) =>
                  formatToolStatus({
                    toolName,
                    displayName,
                    icon,
                    argsSummary,
                    status,
                    durationMs,
                    error,
                    summary,
                    targetWidth: w,
                  }),
                { hangingIndent: 2 },
              );
              this.streamingView.setThinking(true);
              break;
            }
            case 'turn-complete': {
              this.streamingView.setActiveTool(null);
              const finalText = (accumulatedText || event.summary.text || '').trim();
              if (finalText) {
                this.engine.commit('assistant-message', formatAssistantMessage(finalText), {
                  hangingIndent: 2,
                });
              }
              accumulatedText = '';
              this.streamingView.reset();

              // Commit turn finished badge with leading empty line using authoritative duration and verb
              const totalDurationMs =
                event.summary.durationMs ?? Math.round(performance.now() - turnStartTime);
              const finishedAt = event.summary.finishedAt
                ? new Date(event.summary.finishedAt)
                : new Date();
              this.engine.commit('system', [
                '',
                formatTurnStatus(totalDurationMs, finishedAt, event.summary.statusVerb),
              ]);

              if (event.summary.stopReason === 'step-limit') {
                this.engine.commit(
                  'system',
                  formatSystemMessage('Step budget reached. Generation stopped early.'),
                );
              }
              break;
            }
            case 'error': {
              this.streamingView.reset();
              const structured = classifyError(event.error);
              this.engine.commit('system', formatErrorBadge(structured));
              break;
            }
          }
        },
      });
    } catch (err: any) {
      this.streamingView.reset();
      const structured = classifyError(err);
      if (accumulatedText.trim()) {
        this.engine.commit('assistant-message', formatAssistantMessage(accumulatedText), {
          hangingIndent: 2,
        });
        accumulatedText = '';
      }
      this.engine.commit('system', formatErrorBadge(structured));
    } finally {
      if (this.activeModal) {
        this.closeModal();
      }
      this.setBusy(false);
    }
  }

  private setBusy(busy: boolean): void {
    this.isBusy = busy;
    this.promptInput.setDisabled(busy);
    this.statusBar.update({ isBusy: busy });
  }

  private exit(): void {
    this.permissionQueue.clear();
    this.session.shutdown().catch(() => {});
    this.updateChecker.dispose();
    this.engine.cleanupSync();
    if (this.onExitCallback) {
      this.onExitCallback();
    } else {
      process.exit(0);
    }
  }
}
