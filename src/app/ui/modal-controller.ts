import TerminalEngine from '@steward/tui/engine/TerminalEngine.js';
import { AgentSession } from '@steward/agents/engine/agent-session.js';
import type { ModelDescriptor } from '@steward/agents/models/index.js';
import type { SessionData } from '@steward/services/session/types.js';
import { listSessions, loadSession } from '@steward/services/session/index.js';
import { saveSettings, saveThemeSelection } from '@steward/services/config/index.js';
import { setActiveTheme, getActiveThemeName, listThemes } from '@steward/tui/theme/index.js';
import type { ThemeMeta } from '@steward/tui/theme/colors.js';
import type { DiscoveredModel, ProviderId, AuthManager } from '@steward/ai';
import { createAuthManager } from '@steward/ai';
import LoginDock from './components/docks/LoginDock.js';
import ModelPicker from './components/docks/ModelPicker.js';
import ThemePicker from './components/docks/ThemePicker.js';
import SessionMenu from './components/docks/SessionMenu.js';
import ShortcutsMenu from './components/docks/ShortcutsMenu.js';
import EffortPicker from './components/docks/EffortPicker.js';
import RewindMenu from './components/docks/RewindMenu.js';
import type { FilePermissionRequest } from '@steward/agents/tools/types.js';
import BashPermissionDock from './components/docks/BashPermissionDock.js';
import FilePermissionDock from './components/docks/FilePermissionDock.js';
import PromptInput from './components/PromptInput.js';
import StatusBar from './components/StatusBar.js';
import Header from './components/Header.js';
import StreamingView from './components/StreamingView.js';
import { formatSystemMessage } from './utils/message-formatter.js';
import { renderTranscript } from './utils/transcript.js';
import { executeRewind, recoverPendingCheckpoint } from '@steward/services/checkpoint/index.js';
import { cycleMode } from '@steward/agents/policy/modes.js';
import { saveModeSelection } from '@steward/services/config/settings.js';

/**
 * Dependencies passed to ModalController at construction time.
 * All callbacks are closures capturing TUIApp's own fields so ModalController
 * never reaches back into TUIApp directly.
 */
export interface ModalControllerDeps {
  engine: TerminalEngine;
  getSession: () => AgentSession;
  setSession: (s: AgentSession) => void;
  promptInput: PromptInput;
  statusBar: StatusBar;
  header: Header;
  streamingView: StreamingView;
  cwd: string;
}

type AnyModal =
  | LoginDock
  | ModelPicker
  | ThemePicker
  | SessionMenu
  | ShortcutsMenu
  | EffortPicker
  | RewindMenu
  | BashPermissionDock
  | FilePermissionDock;

/**
 * Owns the activeModal discriminated-union field and all open / closeModal
 * operations that were previously inlined in TUIApp (~200 lines removed from app.ts).
 */
export class ModalController {
  private activeModal: AnyModal | null = null;
  private deps: ModalControllerDeps;
  private authManager: AuthManager = createAuthManager();

  constructor(deps: ModalControllerDeps) {
    this.deps = deps;
  }

  /** Returns the current active modal (or null). Read-only access for TUIApp. */
  public getActiveModal(): AnyModal | null {
    return this.activeModal;
  }

  /** Returns true if a modal of the given class is currently mounted. */
  public isInstanceOf(ctor: new (...args: any[]) => AnyModal): boolean {
    return this.activeModal instanceof ctor;
  }

  public closeModal(): void {
    const { engine, promptInput, statusBar } = this.deps;
    if (this.activeModal) {
      engine.unmount(this.activeModal);
      engine.unmount(statusBar);
      this.activeModal = null;
      engine.mount(promptInput, { keepCursorVisible: true, kind: 'input' });
      engine.mount(statusBar);
    }
  }

  public toggleHelp(): void {
    if (this.activeModal instanceof ShortcutsMenu) {
      this.closeModal();
      return;
    }
    this.openHelp();
  }

  public openHelp(): void {
    const { engine, promptInput, statusBar } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const help = new ShortcutsMenu({
      onClose: () => this.closeModal(),
    });
    this.activeModal = help;
    engine.mount(help, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public openLoginDock(targetProvider?: ProviderId): void {
    const { engine, promptInput, statusBar } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const dock = new LoginDock({
      authManager: this.authManager,
      targetProvider,
      onSuccess: (provider) => {
        engine.commit(
          'system',
          formatSystemMessage(
            `Authenticated with ${provider}. Stored credentials in ~/.steward/auth.json`,
          ),
        );
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = dock;
    engine.mount(dock, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public openModelPicker(models: DiscoveredModel[]): void {
    const { engine, promptInput, statusBar, header } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const session = this.deps.getSession();
    const currentModel = session.getModel();
    const picker = new ModelPicker({
      models,
      currentModel,
      onSelect: (selected) => {
        const updated = session.setModel({
          provider: selected.provider,
          modelId: selected.modelId,
          effort: currentModel.effort ?? 'medium',
        });
        saveSettings({
          model: {
            provider: updated.provider,
            modelId: updated.modelId,
            effort: updated.effort,
          },
        });
        header.props.model = updated;
        this.deps.statusBar.update({ model: updated });
        engine.commit(
          'system',
          formatSystemMessage(`Active model switched to ${selected.provider}/${selected.modelId}`),
        );
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    engine.mount(picker, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public openThemePicker(themes: ThemeMeta[]): void {
    const { engine, promptInput, statusBar, header, streamingView } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const currentTheme = getActiveThemeName();
    const session = this.deps.getSession();
    const picker = new ThemePicker({
      themes,
      currentTheme,
      onSelect: (selected) => {
        setActiveTheme(selected.name);
        saveThemeSelection(selected.name);
        renderTranscript(engine, session.session, header);
        engine.mount(streamingView);
        engine.mount(promptInput, { keepCursorVisible: true, kind: 'input' });
        engine.mount(statusBar);
        engine.requestFrame(true);
        engine.commit('system', formatSystemMessage(`Theme switched to ${selected.label}.`));
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    engine.mount(picker, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public switchToSession(selected: SessionData): void {
    const { engine, promptInput, statusBar, header, streamingView, cwd } = this.deps;
    const session = this.deps.getSession();
    recoverPendingCheckpoint(cwd, selected.id).catch(() => {});
    session.shutdown().catch(() => {});
    const newSession = AgentSession.resume(selected);
    this.deps.setSession(newSession);
    const model = newSession.getModel();
    header.props.model = model;
    statusBar.update({ model });

    renderTranscript(engine, selected, header);

    engine.mount(streamingView);
    engine.mount(promptInput, { keepCursorVisible: true, kind: 'input' });
    engine.mount(statusBar);
  }

  public openSessionMenu(sessions: SessionData[]): void {
    const { engine, promptInput, statusBar } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const menu = new SessionMenu({
      sessions,
      onSelect: (selected) => {
        this.closeModal();
        this.switchToSession(selected);
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = menu;
    engine.mount(menu, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public openEffortPicker(): void {
    const { engine, promptInput, statusBar, header } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const session = this.deps.getSession();
    const currentEffort = session.getEffort();
    const picker = new EffortPicker({
      currentEffort,
      onSelect: (selected, persist) => {
        session.setEffort(selected, persist);
        const updatedModel = session.getModel();
        header.props.model = updatedModel;
        statusBar.update({ model: updatedModel });
        const scope = persist ? 'saved globally to settings' : 'for this session only';
        engine.commit(
          'system',
          formatSystemMessage(`Reasoning effort set to "${selected}" (${scope})`),
        );
        this.closeModal();
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = picker;
    engine.mount(picker, { kind: 'dock' });
    engine.mount(statusBar);
  }

  public openRewindMenu(): void {
    const { engine, promptInput, statusBar, cwd } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(promptInput);
    engine.unmount(statusBar);

    const session = this.deps.getSession();
    const menu = new RewindMenu({
      session: session.session,
      cwd,
      onSelect: async (item) => {
        this.closeModal();

        const res = await executeRewind({
          session: session.session,
          targetTurnId: item.turnId,
          workspaceRoot: cwd,
        });

        if (res.success) {
          this.switchToSession(res.rewoundSession);
          engine.commit(
            'system',
            formatSystemMessage(
              `Rewound to before turn ${item.turnIndex + 1} (${res.restoredFilesCount} file(s) restored, ${res.discardedTurnsCount} turn(s) discarded).`,
            ),
          );
        } else {
          engine.commit('system', formatSystemMessage(`Rewind failed: ${res.error}`));
        }
      },
      onCancel: () => this.closeModal(),
    });

    this.activeModal = menu;
    engine.mount(menu, { kind: 'dock' });
    engine.mount(statusBar);
  }

  /**
   * Shows a permission dock (bash or file). Called from PermissionQueue.onShow.
   * Returns the newly mounted dock so callers can set this.activeModal.
   */
  public showBashPermissionDock(params: {
    command: string;
    explanation: string;
    onDecision: (allowed: boolean) => void;
  }): BashPermissionDock {
    const { engine, statusBar } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(this.deps.promptInput);
    engine.unmount(statusBar);

    const dock = new BashPermissionDock({
      command: params.command,
      explanation: params.explanation,
      onDecision: params.onDecision,
    });
    this.activeModal = dock;
    engine.mount(dock, { kind: 'dock' });
    engine.mount(statusBar);
    return dock;
  }

  public showFilePermissionDock(params: {
    request: FilePermissionRequest;
    onDecision: (allowed: boolean) => void;
  }): FilePermissionDock {
    const { engine, statusBar } = this.deps;
    if (this.activeModal) this.closeModal();
    engine.unmount(this.deps.promptInput);
    engine.unmount(statusBar);

    const dock = new FilePermissionDock({
      request: params.request,
      onDecision: params.onDecision,
    });
    this.activeModal = dock;
    engine.mount(dock, { kind: 'dock' });
    engine.mount(statusBar);
    return dock;
  }

  /**
   * Convenience re-exports used by PermissionQueue.onHide to check the modal type.
   */
  public isPermissionDock(): boolean {
    return (
      this.activeModal instanceof BashPermissionDock ||
      this.activeModal instanceof FilePermissionDock
    );
  }
}
