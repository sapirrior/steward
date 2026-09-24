import type { CommandResult } from './types.js';
import { listSessions, loadSession } from '@steward/services/session/index.js';
import { listThemes } from '@steward/tui/theme/index.js';
import { formatSystemMessage } from '../ui/utils/message-formatter.js';

/**
 * Minimal interface of TUIApp methods that applyCommandResult needs to call.
 * Using a narrow interface instead of importing TUIApp avoids a circular reference
 * between handle-command-result.ts and app.ts.
 */
export interface CommandResultCtx {
  engine: {
    clearAll(): void;
    commit(slot: string, content: any, opts?: any): void;
    mount(comp: any, opts?: any): void;
    components: any[];
    requestFrame(force?: boolean): void;
  };
  header: { render(): any };
  streamingView: any;
  promptInput: any;
  statusBar: {
    setMode(mode: string): void;
    update(opts: any): void;
  };
  session: {
    getModel(): any;
  };
  modals: {
    openRewindMenu(): void;
    openModelPicker(models: any[]): void;
    openThemePicker(themes: any[]): void;
    openEffortPicker(): void;
    openLoginDock(targetProvider?: any): void;
    switchToSession(s: any): void;
    openSessionMenu(sessions: any[]): void;
  };
  exit(): void;
  commitPrompt(text: string): void;
}

/**
 * Processes the result of a slash-command execution and performs the
 * appropriate side effects on the TUI (opening modals, committing messages,
 * switching sessions, etc.).
 *
 * Extracted verbatim from the first ~70 lines of TUIApp.handleSubmit.
 * Returns true if the caller should return early (i.e. the command fully
 * consumed the submit), false if normal model execution should follow.
 */
export async function applyCommandResult(
  text: string,
  cmdResult: CommandResult,
  ctx: CommandResultCtx,
): Promise<boolean> {
  if (cmdResult.data?.clearHistory) {
    ctx.engine.clearAll();
    ctx.engine.commit('header', ctx.header.render());
    ctx.engine.mount(ctx.streamingView);
    ctx.engine.mount(ctx.promptInput, { keepCursorVisible: true, kind: 'input' });
    ctx.engine.mount(ctx.statusBar);
    return true;
  }

  if (cmdResult.data?.exit) {
    ctx.exit();
    return true;
  }

  ctx.commitPrompt(text);

  if (cmdResult.data?.showLoginDock) {
    ctx.modals.openLoginDock(cmdResult.data.targetProvider);
    return true;
  }

  if (cmdResult.data?.showRewind) {
    ctx.modals.openRewindMenu();
    return true;
  }

  if (cmdResult.data?.showModelPicker) {
    ctx.modals.openModelPicker(cmdResult.data.models ?? []);
    return true;
  }

  if (cmdResult.data?.showThemePicker) {
    ctx.modals.openThemePicker(cmdResult.data.themes ?? listThemes());
    return true;
  }

  if (cmdResult.data?.themeSwitched) {
    for (const comp of ctx.engine.components) comp.markDirty();
    ctx.engine.requestFrame(true);
  }

  if (cmdResult.data?.modeSwitched && cmdResult.data?.selectedMode) {
    ctx.statusBar.setMode(cmdResult.data.selectedMode.name);
  }

  if (cmdResult.data?.showEffortPicker) {
    ctx.modals.openEffortPicker();
    return true;
  }

  if (cmdResult.data?.resumeDirect) {
    ctx.modals.switchToSession(cmdResult.data.resumeDirect);
    return true;
  }

  if (cmdResult.data?.showResume) {
    const summaries = listSessions();
    const loadedSessions = summaries
      .map((s) => loadSession(s.id))
      .filter((s): s is NonNullable<typeof s> => s !== null);
    ctx.modals.openSessionMenu(cmdResult.data.sessions ?? loadedSessions);
    return true;
  }

  if (cmdResult.message) {
    ctx.engine.commit('system', formatSystemMessage(cmdResult.message));
  }

  const updatedModel = ctx.session.getModel();
  ctx.header.render();
  ctx.statusBar.update({ model: updatedModel });
  return true;
}
