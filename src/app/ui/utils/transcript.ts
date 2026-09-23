import type TerminalEngine from '@steward/tui/engine/TerminalEngine.js';
import type { SessionData } from '@steward/services/session/types.js';
import type Header from '../components/Header.js';
import {
  loadSessionLog,
  buildSessionPresentationProjection,
} from '@steward/services/session/logs/store.js';
import type { TurnPresentationEnd } from '@steward/services/session/logs/types.js';
import { rehydrateSessionHistory } from '@steward/services/session/helpers.js';
import {
  formatTurnStatus,
  formatSystemMessage,
  formatErrorBadge,
  formatToolStatus,
  formatAssistantMessage,
} from './message-formatter.js';
import { classifyError } from '@steward/services/errors/index.js';
import { c } from '@steward/tui/theme/style.js';

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

import {
  defaultToolCatalog,
  summarizeToolResult,
  summarizeToolArgs,
} from '@steward/agents/index.js';

export function renderTranscript(
  engine: TerminalEngine,
  sessionData: SessionData,
  header: Header,
  options?: { expanded?: boolean },
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
      if (toolData.toolName === 'direct-bash') {
        const cmd = toolData.displayName || '';
        const lines: string[] = [`${c.permission('!')} ${c.text(cmd)}`];
        if (toolData.status === 'completed') {
          if (toolData.toolOutput) {
            const outLines = toolData.toolOutput.split(/\r?\n/);
            lines.push(`  ${c.muted('└ ')}${c.text(outLines[0] ?? '')}`);
            for (let i = 1; i < outLines.length; i++) {
              lines.push(`    ${c.text(outLines[i] ?? '')}`);
            }
          }
        } else {
          const errMsg =
            toolData.error ||
            (toolData.toolOutput ? `Command failed: ${toolData.toolOutput}` : 'Command failed');
          const errLines = errMsg.split(/\r?\n/);
          lines.push(`  ${c.muted('└ ')}${c.error(errLines[0] ?? '')}`);
          for (let i = 1; i < errLines.length; i++) {
            lines.push(`     ${c.error(errLines[i] ?? '')}`);
          }
        }
        engine.commit('raw', lines);
        continue;
      }

      const toolDef = defaultToolCatalog.get(toolData.toolName);
      const displayName = toolData.displayName ?? toolDef?.displayName;
      const icon = toolData.icon ?? toolDef?.icon;
      // Use tool-def-aware args summary (matches live session path in app.ts)
      const argsSummary =
        toolDef && toolData.args != null
          ? summarizeToolArgs(toolDef, toolData.args)
          : (toolData.argsSummary ?? '');
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
            argsSummary,
            status: toolData.status,
            durationMs: toolData.durationMs,
            error: toolData.error,
            summary,
            targetWidth: w,
            expanded: options?.expanded,
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
