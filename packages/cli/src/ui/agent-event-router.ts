import { TerminalEngine } from 'stitchable';
import {
  type AgentEventListener,
  defaultToolCatalog,
  summarizeToolResult,
  summarizeToolArgs,
  classifyError,
  logError,
} from '@steward/agent';
import {
  formatAssistantMessage,
  formatToolStatus,
  formatErrorBadge,
  formatTurnStatus,
  formatSystemMessage,
} from './utils/message-formatter.js';
import type StreamingView from './components/StreamingView.js';

export interface AgentEventState {
  accumulatedText: string;
  activeToolStartTimes: Map<string, number>;
  turnStartTime: number;
}

export interface AgentEventRouterDeps {
  engine: TerminalEngine;
  streamingView: StreamingView;
  logError: typeof logError;
  getSessionId: () => string;
  state: AgentEventState;
}

export function createAgentEventHandler(deps: AgentEventRouterDeps): AgentEventListener {
  const { engine, streamingView, state } = deps;

  return (event) => {
    switch (event.type) {
      case 'reasoning-delta': {
        break;
      }
      case 'text-delta': {
        state.accumulatedText += event.text;
        streamingView.setStream(state.accumulatedText, true);
        break;
      }
      case 'tool-call': {
        if (state.accumulatedText.trim()) {
          engine.commit(formatAssistantMessage(state.accumulatedText), {
            tag: 'assistant-message',
            hangingIndent: 2,
          });
          state.accumulatedText = '';
          streamingView.reset();
        }

        state.activeToolStartTimes.set(event.toolCall.id, performance.now());
        const toolDef = defaultToolCatalog.get(event.toolCall.name);
        streamingView.setActiveTool({
          id: event.toolCall.id,
          name: event.toolCall.name,
          displayName: toolDef?.displayName,
          args: event.toolCall.args,
          startTime: performance.now(),
        });
        break;
      }
      case 'tool-result': {
        streamingView.setActiveTool(null);
        const start = state.activeToolStartTimes.get(event.toolResult.id);
        const durationMs =
          event.toolResult.durationMs ??
          (start ? Math.round(performance.now() - start) : undefined);
        state.activeToolStartTimes.delete(event.toolResult.id);

        const toolDef = defaultToolCatalog.get(event.toolResult.name);

        const toolName = event.toolResult.name;
        const displayName = toolDef?.displayName;
        const icon = toolDef?.icon;
        const argsSummary = summarizeToolArgs(toolDef, event.toolResult.args);
        const status = event.toolResult.isError ? 'failed' : 'completed';
        const error = event.toolResult.isError
          ? typeof event.toolResult.result === 'object' && event.toolResult.result !== null
            ? ((event.toolResult.result as any).message ?? JSON.stringify(event.toolResult.result))
            : String(event.toolResult.result)
          : undefined;
        const summary = summarizeToolResult(
          toolDef,
          event.toolResult.args,
          event.toolResult.result,
          event.toolResult.isError,
        );

        engine.commit(
          (w) =>
            formatToolStatus({
              toolName,
              displayName,
              icon,
              argsSummary,
              status,
              durationMs,
              error,
              summary,
              targetWidth: w,
            }),
          { tag: 'tool-result', hangingIndent: 2 },
        );
        streamingView.setThinking(true);
        break;
      }
      case 'turn-complete': {
        streamingView.setActiveTool(null);
        const finalText = (
          state.accumulatedText ||
          (event.summary.toolCalls.length === 0 ? event.summary.text : '') ||
          ''
        ).trim();
        if (finalText) {
          engine.commit(formatAssistantMessage(finalText), {
            tag: 'assistant-message',
            hangingIndent: 2,
          });
        }
        state.accumulatedText = '';
        streamingView.reset();

        const totalDurationMs =
          event.summary.durationMs ?? Math.round(performance.now() - state.turnStartTime);
        const finishedAt = event.summary.finishedAt
          ? new Date(event.summary.finishedAt)
          : new Date();
        engine.commit(
          [
            '',
            formatTurnStatus(totalDurationMs, finishedAt, event.summary.statusVerb),
          ],
          { tag: 'system' },
        );

        if (event.summary.stopReason === 'step-limit') {
          engine.commit(
            formatSystemMessage('Step budget reached. Generation stopped early.'),
            { tag: 'system' },
          );
        }
        break;
      }
      case 'error': {
        streamingView.reset();
        deps.logError(event.error, {
          sessionId: deps.getSessionId(),
          source: 'stream-error-event',
          isFatal: event.isFatal,
        });
        const structured = classifyError(event.error);
        engine.commit(formatErrorBadge(structured), { tag: 'system' });
        break;
      }
    }
  };
}
