import type { SessionLogEvent } from '../services/session/logs/types.js';
import { defaultToolCatalog } from '../tools/index.js';
import { summarizeToolResult, formatPlainToolSummary } from '../tools/summary.js';
import type { AgentTurnEvent } from './types.js';

export function translateAgentEventToLogEvent(
  event: AgentTurnEvent,
  context: { sessionId: string; turnId: string },
): SessionLogEvent | null {
  if (event.type === 'tool-call') {
    return {
      schemaVersion: 1,
      sessionId: context.sessionId,
      turnId: context.turnId,
      type: 'tool-start',
      timestamp: new Date().toISOString(),
      toolCallId: event.toolCall.id,
      toolName: event.toolCall.name,
      startedAt: new Date().toISOString(),
    };
  }

  if (event.type === 'tool-result') {
    const toolDef = defaultToolCatalog.get(event.toolResult.name);
    const summaryObj = summarizeToolResult(
      toolDef,
      event.toolResult.args,
      event.toolResult.result,
      event.toolResult.isError,
    );
    const outputSummary = formatPlainToolSummary(summaryObj);
    const errorMessage = event.toolResult.isError
      ? typeof event.toolResult.result === 'object' && event.toolResult.result !== null
        ? ((event.toolResult.result as any).message ?? JSON.stringify(event.toolResult.result))
        : String(event.toolResult.result)
      : undefined;
    const status = event.toolResult.isError ? 'failed' : 'completed';

    return {
      schemaVersion: 1,
      sessionId: context.sessionId,
      turnId: context.turnId,
      type: 'tool-end',
      timestamp: event.toolResult.finishedAt ?? new Date().toISOString(),
      toolCallId: event.toolResult.id,
      toolName: event.toolResult.name,
      finishedAt: event.toolResult.finishedAt ?? new Date().toISOString(),
      durationMs: event.toolResult.durationMs,
      status,
      displayName: toolDef?.displayName,
      icon: toolDef?.icon,
      outputSummary,
      errorMessage,
    };
  }

  return null;
}
