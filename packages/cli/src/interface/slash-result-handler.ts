import type { CommandResult } from '../slash/index.js';
import { listSessions, loadSession } from '@steward/agent';
import {
  formatSlashCommandOutput,
  formatUserMessage,
} from './utils/message-formatter.js';

export interface SlashCommandHandlerCtx {
  engine: {
    clearAll(): void;
    commit(
      lines: string[] | ((w: number) => string[]),
      opts?: { tag?: string; wrap?: boolean; clip?: boolean; hangingIndent?: number },
    ): void;
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
    openLoginPicker?(providers: any[], onSelect: (p: any) => void): void;
    openEffortPicker(): void;
    switchToSession(s: any): void;
    openSessionMenu(sessions: any[]): void;
  };
  commitPrompt?: (t: string) => void;
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

  if (cmdResult.data?.showRewind) {
    ctx.modals.openRewindMenu();
    return true;
  }

  if (cmdResult.data?.showModelPicker) {
    ctx.modals.openModelPicker(cmdResult.data.models ?? []);
    return true;
  }

  if (cmdResult.data?.showLoginPicker && ctx.modals.openLoginPicker) {
    ctx.modals.openLoginPicker(
      cmdResult.data.providers ?? [],
      cmdResult.data.onSelect ?? (() => {}),
    );
    return true;
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
