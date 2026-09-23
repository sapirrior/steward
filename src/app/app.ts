import TerminalEngine from '@steward/tui/engine/TerminalEngine.js';
import { AgentSession } from '@steward/agents/engine/agent-session.js';
import { defaultCommandRegistry } from './commands/registry.js';
import { defaultToolCatalog } from '@steward/agents/tools/index.js';
import type { SessionData } from '@steward/services/session/types.js';
import { isFolderTrusted, trustFolder } from '@steward/services/config/index.js';
import { listThemes } from '@steward/tui/theme/index.js';
import Header from './ui/components/Header.js';
import StatusBar from './ui/components/StatusBar.js';
import StreamingView from './ui/components/StreamingView.js';
import PromptInput from './ui/components/PromptInput.js';
import TrustGate from './ui/components/TrustGate.js';
import BashPermissionDock from './ui/components/docks/BashPermissionDock.js';
import FilePermissionDock from './ui/components/docks/FilePermissionDock.js';
import { PermissionQueue } from './ui/utils/permission-queue.js';
import { parseKeyInput } from '@steward/tui/primitives/index.js';
import {
  formatSystemMessage,
  formatAssistantMessage,
  formatErrorBadge,
} from './ui/utils/message-formatter.js';
import { renderTranscript } from './ui/utils/transcript.js';
import { classifyError, logError } from '@steward/services/errors/index.js';
import { UpdateCheckerService } from '@steward/services/updater/index.js';
import { cycleMode } from '@steward/agents/policy/modes.js';
import { saveModeSelection } from '@steward/services/config/settings.js';
import { ModalController } from './ui/modal-controller.js';
import { createAgentEventHandler, type AgentEventState } from './ui/agent-event-router.js';
import { applyCommandResult } from './commands/handle-command-result.js';

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

  private modals: ModalController;
  private ctrlCPending = false;
  private ctrlCTimer: NodeJS.Timeout | null = null;
  private isBusy = false;
  private isScrollViewMode = false;
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
      onToggleHelp: () => this.modals.toggleHelp(),
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

    this.modals = new ModalController({
      engine: this.engine,
      getSession: () => this.session,
      setSession: (s) => {
        this.session = s;
      },
      promptInput: this.promptInput,
      statusBar: this.statusBar,
      header: this.header,
      streamingView: this.streamingView,
      cwd: this.cwd,
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
        if (this.modals.getActiveModal()) this.modals.closeModal();
        this.engine.unmount(this.promptInput);
        this.engine.unmount(this.statusBar);

        if (item.kind === 'bash') {
          this.modals.showBashPermissionDock({
            command: item.request.command,
            explanation: item.request.explanation,
            onDecision: (allowed) => {
              this.permissionQueue.resolveActive(allowed);
            },
          });
        } else if (item.kind === 'file') {
          this.modals.showFilePermissionDock({
            request: item.request,
            onDecision: (allowed) => {
              this.permissionQueue.resolveActive(allowed);
            },
          });
        }
        this.engine.mount(this.statusBar);
      },
      onHide: () => {
        if (this.modals.isPermissionDock()) {
          this.modals.closeModal();
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
        if (this.isScrollViewMode) return true;
        if (this.modals.getActiveModal()) return true;
        if (this.session.isBusy || this.isBusy) {
          this.statusBar.showWarning('Cannot change mode while Steward is generating');
          return true;
        }
        const newMode = cycleMode();
        saveModeSelection(newMode);
        this.statusBar.setMode(newMode);
        return true;
      }

      // Ctrl+O: toggle scroll view mode when idle
      if (action.type === 'ctrl-o') {
        if (this.modals.getActiveModal()) return true;
        if (this.session.isBusy || this.isBusy) return true;
        this.toggleScrollViewMode();
        return true;
      }

      // In scroll view mode:
      if (this.isScrollViewMode) {
        if (action.type === 'escape' || action.type === 'submit') {
          this.toggleScrollViewMode();
          return true;
        }
        if (action.type === 'cursor-up') {
          this.engine.scrollUp(1);
          return true;
        }
        if (action.type === 'cursor-down') {
          this.engine.scrollDown(1);
          return true;
        }
        if (action.type === 'page-up') {
          const halfPage = Math.max(1, Math.floor(((process.stdout.rows || 24) - 1) / 2));
          this.engine.scrollUp(halfPage);
          return true;
        }
        if (action.type === 'page-down') {
          const halfPage = Math.max(1, Math.floor(((process.stdout.rows || 24) - 1) / 2));
          this.engine.scrollDown(halfPage);
          return true;
        }
      }

      return false;
    });
  }

  private toggleScrollViewMode(): void {
    if (this.isScrollViewMode) {
      // Exit scroll view mode: re-render compact transcript, re-mount interactive controls, and scroll to bottom
      this.isScrollViewMode = false;
      renderTranscript(this.engine, this.session.session, this.header, { expanded: false });
      this.engine.mount(this.streamingView, { kind: 'custom' });
      this.engine.mount(this.promptInput, { keepCursorVisible: true, kind: 'input' });
      this.engine.mount(this.statusBar, { kind: 'custom' });
      this.engine.scrollToBottom();
    } else {
      // Enter scroll view mode: unmount interactive controls, hide cursor, and re-render full expanded transcript
      this.isScrollViewMode = true;
      this.engine.unmount(this.streamingView);
      this.engine.unmount(this.promptInput);
      this.engine.unmount(this.statusBar);
      this.engine.hideCursor();
      renderTranscript(this.engine, this.session.session, this.header, { expanded: true });
    }
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

      await applyCommandResult(text, cmdResult, {
        engine: this.engine,
        header: this.header,
        streamingView: this.streamingView,
        promptInput: this.promptInput,
        statusBar: this.statusBar,
        session: this.session,
        modals: this.modals,
        exit: () => this.exit(),
        commitPrompt: (t) => this.engine.commitPrompt(t),
      });
      return;
    }

    // 2. Submit user prompt to AgentSession
    this.engine.commitPrompt(text);
    this.setBusy(true);
    this.streamingView.setThinking(true);

    const eventState: AgentEventState = {
      accumulatedText: '',
      activeToolStartTimes: new Map(),
      turnStartTime: performance.now(),
    };

    const onEvent = createAgentEventHandler({
      engine: this.engine,
      streamingView: this.streamingView,
      logError,
      getSessionId: () => this.session.session.id,
      state: eventState,
    });

    try {
      await this.session.submitPrompt(text, {
        cwd: this.cwd,
        requestBashPermission: (req) => this.permissionQueue.enqueueBash(req),
        requestFilePermission: (req) => this.permissionQueue.enqueueFile(req),
        onEvent,
      });
    } catch (err: any) {
      this.streamingView.reset();
      const structured = classifyError(err);
      if (eventState.accumulatedText.trim()) {
        this.engine.commit(
          'assistant-message',
          formatAssistantMessage(eventState.accumulatedText),
          {
            hangingIndent: 2,
          },
        );
      }
      this.engine.commit('system', formatErrorBadge(structured));
    } finally {
      if (this.modals.getActiveModal()) {
        this.modals.closeModal();
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
