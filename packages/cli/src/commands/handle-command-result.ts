import type { CommandResult } from './types.js';
import { listSessions, loadSession } from '@steward/services/session/index.js';
import { formatSlashCommandOutput, formatUserMessage } from '../ui/utils/message-formatter.js';
import { c } from '@steward/app/theme/style.js';

export interface SlashCommandHandlerCtx {
  engine: {
    clearAll(): void;
    commit(lines: string[] | ((w: number) => string[]), opts?: { tag?: string; wrap?: boolean; clip?: boolean; hangingIndent?: number }): void;
    mount(comp: any, opts?: any): void;
    components: any[];
    requestFrame(force?: boolean): void;
  };
  header: { render(w?: number): string[] };
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
}

/**
 * Handles all slash-command execution outcomes and applies the appropriate UI state mutations.
 */
export async function handleSlashCommandResult(
  text: string,
  cmdResult: CommandResult,
  ctx: SlashCommandHandlerCtx,
): Promise<boolean> {
  if (cmdResult.data?.clearHistory) {
    ctx.engine.clearAll();
    ctx.engine.commit(ctx.header.render(), { tag: 'header' });
    ctx.engine.mount(ctx.streamingView);
    ctx.engine.mount(ctx.promptInput, { keepCursorVisible: true });
    ctx.engine.mount(ctx.statusBar);
    return true;
  }

  if (cmdResult.data?.exit) {
    ctx.exit();
    return true;
  }

  // Commit the user's prompt to history
  ctx.engine.commit((w) => formatUserMessage(text, w), { tag: 'prompt', wrap: false });

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
    for (const comp of ctx.engine.components) comp.markDirty?.();
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
    ctx.engine.commit(formatSlashCommandOutput(cmdResult.message), { tag: 'system' });
  }

  const updatedModel = ctx.session.getModel();
  ctx.header.render();
  ctx.statusBar.update({ model: updatedModel });
  return true;
}

export const applyCommandResult = handleSlashCommandResult;
export type CommandResultCtx = SlashCommandHandlerCtx;
