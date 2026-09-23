import TerminalEngine from '@steward/tui/engine/TerminalEngine.js';
import type { AgentEventListener } from '@steward/agents/engine/events.js';
import {
  defaultToolCatalog,
  summarizeToolResult,
  summarizeToolArgs,
} from '@steward/agents/tools/index.js';
import { classifyError, logError } from '@steward/services/errors/index.js';
import {
  formatAssistantMessage,
  formatToolStatus,
  formatErrorBadge,
  formatTurnStatus,
  formatSystemMessage,
} from './utils/message-formatter.js';
import type StreamingView from './components/StreamingView.js';

/**
 * Mutable state tracked per-turn by the event handler.
 * Passed as a ref so the router can read/write it across events
 * without holding closures over stale values.
 */
export interface AgentEventState {
  accumulatedText: string;
  activeToolStartTimes: Map<string, number>;
  turnStartTime: number;
}

/**
 * Dependencies required by the agent event router.
 */
export interface AgentEventRouterDeps {
  engine: TerminalEngine;
  streamingView: StreamingView;
  logError: typeof logError;
  getSessionId: () => string;
  state: AgentEventState;
}

/**
 * Creates an AgentEventListener that handles all 7 AgentEvent types and
 * drives the TUI presentation layer accordingly.
 *
 * Extracted verbatim from TUIApp.handleSubmit's onEvent switch (~130 lines)
 * so the switch logic is independently testable without instantiating TUIApp.
 * Task 3 §3.1's logError call lives here (in the 'error' case).
 */
export function createAgentEventHandler(deps: AgentEventRouterDeps): AgentEventListener {
  const { engine, streamingView, state } = deps;

  return (event) => {
    switch (event.type) {
      case 'reasoning-delta': {
        // Internal model reasoning is saved to session messages but not rendered to the TUI
        break;
      }
      case 'text-delta': {
        state.accumulatedText += event.text;
        streamingView.setStream(state.accumulatedText, true);
        break;
      }
      case 'tool-call': {
        // Flush any prior accumulated assistant text before tool execution log
        if (state.accumulatedText.trim()) {
          engine.commit('assistant-message', formatAssistantMessage(state.accumulatedText), {
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
          'tool-result',
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
          { hangingIndent: 2 },
        );
        streamingView.setThinking(true);
        break;
      }
      case 'turn-complete': {
        streamingView.setActiveTool(null);
        const finalText = (state.accumulatedText || event.summary.text || '').trim();
        if (finalText) {
          engine.commit('assistant-message', formatAssistantMessage(finalText), {
            hangingIndent: 2,
          });
        }
        state.accumulatedText = '';
        streamingView.reset();

        // Commit turn finished badge with leading empty line using authoritative duration and verb
        const totalDurationMs =
          event.summary.durationMs ?? Math.round(performance.now() - state.turnStartTime);
        const finishedAt = event.summary.finishedAt
          ? new Date(event.summary.finishedAt)
          : new Date();
        engine.commit('system', [
          '',
          formatTurnStatus(totalDurationMs, finishedAt, event.summary.statusVerb),
        ]);

        if (event.summary.stopReason === 'step-limit') {
          engine.commit(
            'system',
            formatSystemMessage('Step budget reached. Generation stopped early.'),
          );
        }
        break;
      }
      case 'error': {
        streamingView.reset();
        // Task 3 §3.1: log non-fatal stream errors to disk (previously missing)
        deps.logError(event.error, {
          sessionId: deps.getSessionId(),
          source: 'stream-error-event',
          isFatal: event.isFatal,
        });
        const structured = classifyError(event.error);
        engine.commit('system', formatErrorBadge(structured));
        break;
      }
    }
  };
}
