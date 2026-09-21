import type TerminalEngine from '../../../packages/tui/src/engine/TerminalEngine.js';
import type { SessionData } from '../../../packages/services/src/session/types.js';
import type Header from '../components/Header.js';
import {
  loadSessionLog,
  buildSessionPresentationProjection,
} from '../../../packages/services/src/session/logs/store.js';
import type { TurnPresentationEnd } from '../../../packages/services/src/session/logs/types.js';
import { rehydrateSessionHistory } from '../../../packages/services/src/session/helpers.js';
import {
  formatTurnStatus,
  formatSystemMessage,
  formatErrorBadge,
  formatToolStatus,
  formatAssistantMessage,
} from './message-formatter.js';
import { classifyError } from '../../../packages/services/src/errors/index.js';

export function formatTurnFooter(
  engine: TerminalEngine,
  turnPresentationEnd?: TurnPresentationEnd,
): void {
  if (!turnPresentationEnd) return;

  if (turnPresentationEnd.status === 'complete') {
    engine.commit('system', [
      '',
      formatTurnStatus(
        turnPresentationEnd.durationMs,
        new Date(turnPresentationEnd.finishedAt),
        turnPresentationEnd.statusVerb,
      ),
    ]);
    if (turnPresentationEnd.stopReason === 'step-limit') {
      engine.commit(
        'system',
        formatSystemMessage('Step budget reached. Generation stopped early.'),
      );
    }
  } else if (
    (turnPresentationEnd.status === 'errored' || turnPresentationEnd.status === 'interrupted') &&
    turnPresentationEnd.errorMessage
  ) {
    const structured = classifyError(new Error(turnPresentationEnd.errorMessage));
    engine.commit('system', formatErrorBadge(structured));
  }
}

import { defaultToolCatalog, summarizeToolResult } from '../../../packages/agents/src/index.js';

export function renderTranscript(
  engine: TerminalEngine,
  sessionData: SessionData,
  header: Header,
): void {
  engine.clearAll();
  engine.commit('header', header.render());

  const log = loadSessionLog(sessionData.date, sessionData.id);
  const projection = log ? buildSessionPresentationProjection(log.events) : null;
  const items = rehydrateSessionHistory(sessionData, projection);

  let currentTurnId: string | undefined = undefined;

  for (const item of items) {
    if (item.turnId && item.turnId !== currentTurnId) {
      if (currentTurnId && projection) {
        const prevTurnPresentation = projection.turns.get(currentTurnId)?.end;
        formatTurnFooter(engine, prevTurnPresentation);
      }
      currentTurnId = item.turnId;
    }

    if (item.type === 'user') {
      engine.commitPrompt(item.content);
    } else if (item.type === 'system') {
      engine.commit('system', formatSystemMessage(item.content));
    } else if (item.type === 'tool' && item.toolData) {
      const toolData = item.toolData;
      const toolDef = defaultToolCatalog.get(toolData.toolName);
      const displayName = toolData.displayName ?? toolDef?.displayName;
      const icon = toolData.icon ?? toolDef?.icon;
      const summary =
        summarizeToolResult(
          toolDef,
          toolData.args,
          toolData.result,
          toolData.status === 'failed',
        ) ?? toolData.toolOutput;

      engine.commit(
        'tool-result',
        (w) =>
          formatToolStatus({
            toolName: toolData.toolName,
            displayName,
            icon,
            argsSummary: toolData.argsSummary,
            status: toolData.status,
            durationMs: toolData.durationMs,
            error: toolData.error,
            summary,
            targetWidth: w,
          }),
        { hangingIndent: 2 },
      );
    } else if (item.type === 'assistant') {
      engine.commit('assistant-message', formatAssistantMessage(item.content), {
        hangingIndent: 2,
      });
    }
  }

  if (currentTurnId && projection) {
    const lastTurnPresentation = projection.turns.get(currentTurnId)?.end;
    formatTurnFooter(engine, lastTurnPresentation);
  }
}
