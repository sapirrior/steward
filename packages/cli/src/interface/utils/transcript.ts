import type { TerminalEngine } from 'stitchable';
import type Header from '../components/Header.js';
import {
  type SessionData,
  loadSessionLog,
  buildSessionPresentationProjection,
  type TurnPresentationEnd,
  rehydrateSessionHistory,
  defaultToolCatalog,
  summarizeToolResult,
  summarizeToolArgs,
} from '@steward/agent';
import {
  formatTurnStatus,
  formatSystemMessage,
  formatErrorBadge,
  formatToolStatus,
  formatAssistantMessage,
  formatUserMessage,
} from './message-formatter.js';
import { c } from '../../theme/index.js';

export function formatTurnFooter(
  engine: TerminalEngine,
  turnPresentationEnd?: TurnPresentationEnd,
  fallbackTurn?: { status?: string },
): void {
  if (turnPresentationEnd) {
    if (turnPresentationEnd.status === 'complete') {
      engine.commit(
        [
          '',
          formatTurnStatus(
            turnPresentationEnd.durationMs,
            new Date(turnPresentationEnd.finishedAt),
            turnPresentationEnd.statusVerb,
          ),
        ],
        { tag: 'system' },
      );
      if (turnPresentationEnd.stopReason === 'step-limit') {
        engine.commit(formatSystemMessage('Step budget reached. Generation stopped early.'), {
          tag: 'system',
        });
      }
    } else if (
      (turnPresentationEnd.status === 'errored' || turnPresentationEnd.status === 'interrupted') &&
      (turnPresentationEnd.error || turnPresentationEnd.errorMessage)
    ) {
      const errToFormat = turnPresentationEnd.error ?? new Error(turnPresentationEnd.errorMessage!);
      engine.commit(formatErrorBadge(errToFormat), { tag: 'system' });
    }
    return;
  }

  // Fallback if presentation logs were not present
  if (fallbackTurn?.status === 'errored') {
    engine.commit(formatErrorBadge(new Error('Turn failed with error')), { tag: 'system' });
  } else if (fallbackTurn?.status === 'interrupted') {
    engine.commit(formatErrorBadge({ code: 'aborted', message: 'Interrupted' }), { tag: 'system' });
  }
}

export function renderTranscript(
  engine: TerminalEngine,
  sessionData: SessionData,
  header: Header,
  options?: { expanded?: boolean },
): void {
  engine.clearAll();
  engine.commit(header.render(), { wrap: false, tag: 'header' });

  const log = loadSessionLog(sessionData.date, sessionData.id);
  const projection = log ? buildSessionPresentationProjection(log.events) : null;
  const items = rehydrateSessionHistory(sessionData, projection);

  const turnMap = new Map<string, (typeof sessionData.turns)[0]>();
  for (const t of sessionData.turns) {
    turnMap.set(t.id, t);
  }

  let currentTurnId: string | undefined = undefined;

  for (const item of items) {
    if (item.turnId && item.turnId !== currentTurnId) {
      if (currentTurnId) {
        const prevTurnPresentation = projection?.turns.get(currentTurnId)?.end;
        const prevFallbackTurn = turnMap.get(currentTurnId);
        formatTurnFooter(engine, prevTurnPresentation, prevFallbackTurn);
      }
      currentTurnId = item.turnId;
    }

    if (item.type === 'user') {
      engine.commit((w) => formatUserMessage(item.content, w), { tag: 'prompt', wrap: false });
    } else if (item.type === 'system') {
      engine.commit(formatSystemMessage(item.content), { tag: 'system' });
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
        engine.commit(lines, { tag: 'raw' });
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
        { hangingIndent: 2, tag: 'tool-result' },
      );
    } else if (item.type === 'assistant') {
      engine.commit(formatAssistantMessage(item.content), {
        tag: 'assistant-message',
        hangingIndent: 2,
      });
    }
  }

  if (currentTurnId) {
    const lastTurnPresentation = projection?.turns.get(currentTurnId)?.end;
    const lastFallbackTurn = turnMap.get(currentTurnId);
    formatTurnFooter(engine, lastTurnPresentation, lastFallbackTurn);
  }
}
