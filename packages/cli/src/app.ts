import { existsSync } from 'node:fs';
import { TerminalEngine, type InputEvent, type TerminalIO } from 'stitchable';
import {
  AgentSession,
  defaultToolCatalog,
  type SessionData,
  SessionLogWriter,
  getSessionLogPath,
  isFolderTrusted,
  trustFolder,
  logError,
  cycleMode,
  setActiveMode,
  getSavedMode,
  saveModeSelection,
} from '@steward/agent';
import { defaultCommandRegistry } from './commands/registry.js';
import { c } from './theme/style.js';
import Header from './interface/components/Header.js';
import StatusBar from './interface/components/StatusBar.js';
import StreamingView from './interface/components/StreamingView.js';
import PromptInput from './interface/components/PromptInput.js';
import TrustGate from './interface/components/TrustGate.js';
import BashPermissionDock from './interface/components/docks/BashPermissionDock.js';
import FilePermissionDock from './interface/components/docks/FilePermissionDock.js';
import { PermissionQueue } from './interface/utils/permission-queue.js';
import {
  formatSystemMessage,
  formatAssistantMessage,
  formatErrorBadge,
  formatUserMessage,
} from './interface/utils/message-formatter.js';
import { renderTranscript } from './interface/utils/transcript.js';
import type { AI } from '@steward/ai';
import { createRuntime } from './runtime.js';
import { ModalController } from './interface/modal-controller.js';
import { createAgentEventHandler, type AgentEventState } from './interface/agent-event-router.js';
import { applyCommandResult } from './commands/handle-command-result.js';
import { executeDirectBash } from './utils/bash.js';

export interface TUIAppOptions {
  version?: string;
  ai?: AI;
  initialSession?: AgentSession;
  cwd?: string;
  io?: TerminalIO;
  onExit?: () => void;
}

export class TUIApp {
  public readonly engine: TerminalEngine;
  private ai: AI;
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
  private permissionQueue: PermissionQueue;
  private directBashAbortController: AbortController | null = null;

  constructor(options: TUIAppOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    const runtime = options.ai ? undefined : createRuntime();
    this.ai = options.ai ?? (runtime!.ai as AI);
    this.session =
      options.initialSession ??
      new AgentSession(undefined, undefined, { ai: runtime?.modelPort ?? (this.ai as any) });
    this.onExitCallback = options.onExit;
    this.engine = new TerminalEngine({
      io: options.io,
      mouse: true,
      scrollKeys: true,
      onError: (err) => logError(err),
    });

    const savedMode = getSavedMode();
    if (savedMode) {
      setActiveMode(savedMode);
    }

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
      onBashModeChange: (isBash) => this.statusBar.setBashMode(isBash),
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

    this.engine.mount(trustGate);
  }

  private proceedStart(): void {
    this.engine.ensureAlternateScreen();

    // Rehydrate previous session turns or direct commands if any, or render header
    const logPath = getSessionLogPath(this.session.session.date, this.session.session.id);
    if (this.session.session.turns.length > 0 || existsSync(logPath)) {
      renderTranscript(this.engine, this.session.session, this.header);
    } else {
      this.engine.commit(this.header.render(), { wrap: false, tag: 'header' });
    }

    // Mount live interactive components at the bottom
    this.engine.mount(this.streamingView);
    this.engine.mount(this.promptInput, { keepCursorVisible: true });
    this.engine.mount(this.statusBar);

    // Handle global keybindings
    this.engine.addInputListener((ev: InputEvent) => {
      const { key } = ev;

      // Ctrl+C double-tap handling
      // Note: key.name holds the letter; input is '' for control chords.
      if (key.ctrl && key.name === 'c') {
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
      if (key.ctrl && key.name === 'b') {
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
      if (key.ctrl && key.name === 'o') {
        if (this.modals.getActiveModal()) return true;
        if (this.session.isBusy || this.isBusy) return true;
        this.toggleScrollViewMode();
        return true;
      }

      // In scroll view mode: Esc/Enter exits; arrow keys scroll 1 line.
      // PageUp/PageDown are consumed by the engine's scrollKeys handler
      // (rows−1 math) before reaching listeners, so we don't duplicate them.
      if (this.isScrollViewMode) {
        if (key.escape || key.return) {
          this.toggleScrollViewMode();
          return true;
        }
        if (key.upArrow) {
          this.engine.scrollUp(1);
          return true;
        }
        if (key.downArrow) {
          this.engine.scrollDown(1);
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
      this.engine.mount(this.streamingView);
      this.engine.mount(this.promptInput, { keepCursorVisible: true });
      this.engine.mount(this.statusBar);
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
      if (this.directBashAbortController) {
        this.directBashAbortController.abort();
      }
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
        getScreenLines: () =>
          this.engine.history
            .getEntries()
            .filter((e) => e.tag !== 'logo')
            .flatMap((e) => e.lines),
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
        commitPrompt: (t: string) =>
          this.engine.commit((w) => formatUserMessage(t, w), { tag: 'prompt', wrap: false }),
      });
      return;
    }

    // 2. Direct bash command execution (!)
    if (text.startsWith('!')) {
      const command = text.slice(1).trim();
      if (!command) return;

      this.setBusy(true);
      this.directBashAbortController = new AbortController();
      const callId = `direct-bash-${Date.now()}`;
      const startedAt = new Date().toISOString();
      const logWriter = new SessionLogWriter(this.session.session.date, this.session.session.id);

      logWriter.append({
        schemaVersion: 1,
        sessionId: this.session.session.id,
        turnId: `direct-${Date.now()}`,
        type: 'tool-start',
        timestamp: startedAt,
        toolCallId: callId,
        toolName: 'bash',
        startedAt,
      });

      this.streamingView.setActiveCommand(command);

      try {
        const result = await executeDirectBash({
          command,
          cwd: this.cwd,
          abortSignal: this.directBashAbortController.signal,
          onChunk: (_chunk, fullOutput) => {
            const recent = fullOutput.split(/\r?\n/).filter(Boolean);
            this.streamingView.updateCommandOutput(recent);
          },
        });

        this.streamingView.setActiveCommand(null);
        this.streamingView.reset();

        logWriter.append({
          schemaVersion: 1,
          sessionId: this.session.session.id,
          turnId: `direct-${Date.now()}`,
          type: 'tool-end',
          timestamp: new Date().toISOString(),
          toolCallId: callId,
          toolName: 'direct-bash',
          finishedAt: new Date().toISOString(),
          durationMs: result.durationMs,
          status: result.exitCode === 0 ? 'completed' : 'failed',
          displayName: command,
          outputSummary: result.output,
          errorMessage:
            result.exitCode !== 0
              ? `Command failed with exit code ${result.exitCode ?? 1}`
              : undefined,
        });

        const lines: string[] = [`${c.permission('!')} ${c.text(command)}`];
        if (result.exitCode === 0) {
          if (result.output) {
            const outLines = result.output.split(/\r?\n/);
            lines.push(`  ${c.muted('└ ')}${c.text(outLines[0] ?? '')}`);
            for (let i = 1; i < outLines.length; i++) {
              lines.push(`    ${c.text(outLines[i] ?? '')}`);
            }
          }
        } else {
          const errMsg = `Command failed with exit code ${result.exitCode ?? 1}${result.output ? ': ' + result.output : ''}`;
          const errLines = errMsg.split(/\r?\n/);
          lines.push(`  ${c.muted('└ ')}${c.error(errLines[0] ?? '')}`);
          for (let i = 1; i < errLines.length; i++) {
            lines.push(`     ${c.error(errLines[i] ?? '')}`);
          }
        }
        this.engine.commit(lines, { tag: 'raw' });
      } catch (err: any) {
        this.streamingView.setActiveCommand(null);
        this.streamingView.reset();
        const msg = err instanceof Error ? err.message : String(err);

        logWriter.append({
          schemaVersion: 1,
          sessionId: this.session.session.id,
          turnId: `direct-${Date.now()}`,
          type: 'tool-end',
          timestamp: new Date().toISOString(),
          toolCallId: callId,
          toolName: 'direct-bash',
          finishedAt: new Date().toISOString(),
          status: 'failed',
          displayName: command,
          errorMessage: msg,
        });

        this.engine.commit(
          [`${c.permission('!')} ${c.text(command)}`, `  ${c.muted('└ ')}${c.error(msg)}`],
          { tag: 'raw' },
        );
      } finally {
        this.directBashAbortController = null;
        this.setBusy(false);
      }
      return;
    }

    // 3. Submit user prompt to AgentSession
    this.engine.commit((w) => formatUserMessage(text, w), { tag: 'prompt', wrap: false });
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
        requestBashPermission: (req: any) => this.permissionQueue.enqueueBash(req),
        requestFilePermission: (req: any) => this.permissionQueue.enqueueFile(req),
        onEvent,
      });
    } catch (err: any) {
      this.streamingView.reset();
      if (eventState.accumulatedText.trim()) {
        this.engine.commit(formatAssistantMessage(eventState.accumulatedText), {
          tag: 'assistant-message',
          hangingIndent: 2,
        });
      }
      this.engine.commit(formatErrorBadge(err), { tag: 'system' });
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
    this.engine.dispose();
    if (this.onExitCallback) {
      this.onExitCallback();
    } else {
      process.exit(0);
    }
  }
}
