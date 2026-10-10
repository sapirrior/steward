import type { AppState, AppStateAction, CompletedTurn } from '../types.js';

export function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.status };

    case 'SET_MODEL':
      return { ...state, modelRef: action.modelRef };

    case 'SET_EFFORT':
      return { ...state, reasoningEffort: action.effort };

    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'TOGGLE_EXPAND_ALL_BASH_CARDS':
      return { ...state, expandAllBashCards: !state.expandAllBashCards };

    case 'START_TURN':
      return {
        ...state,
        status: 'running',
        activeTurn: action.turn,
      };

    case 'APPEND_REASONING': {
      if (!state.activeTurn) return state;
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          reasoning: state.activeTurn.reasoning + action.text,
        },
      };
    }

    case 'FINISH_REASONING': {
      if (!state.activeTurn) return state;
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          reasoningDurationMs: action.durationMs,
        },
      };
    }

    case 'APPEND_TEXT': {
      if (!state.activeTurn) return state;
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          text: state.activeTurn.text + action.text,
        },
      };
    }

    case 'START_TOOL_CALL': {
      if (!state.activeTurn) return state;
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          toolCalls: [...state.activeTurn.toolCalls, action.toolCall],
        },
      };
    }

    case 'FINISH_TOOL_CALL': {
      if (!state.activeTurn) return state;
      const updatedCalls = state.activeTurn.toolCalls.map((call) => {
        if (call.toolCallId === action.toolCallId) {
          return {
            ...call,
            status: (action.isError ? 'error' : 'success') as 'error' | 'success',
            result: action.result,
            durationMs: action.durationMs,
            isError: action.isError,
          };
        }
        return call;
      });
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          toolCalls: updatedCalls,
        },
      };
    }

    case 'SET_RETRY': {
      if (!state.activeTurn) return state;
      return {
        ...state,
        activeTurn: {
          ...state.activeTurn,
          retryAttempt: action.attempt,
          maxRetries: action.maxRetries,
          retryDelayMs: action.delayMs,
          errorMessage: action.errorMessage,
        },
      };
    }

    case 'FINISH_TURN': {
      if (!state.activeTurn) {
        return { ...state, status: 'idle' };
      }

      const completed: CompletedTurn = {
        id: state.activeTurn.id,
        userPrompt: state.activeTurn.userPrompt,
        userTimestamp: state.activeTurn.userTimestamp,
        reasoning: state.activeTurn.reasoning || undefined,
        reasoningDurationMs: state.activeTurn.reasoningDurationMs,
        text: state.activeTurn.text,
        toolCalls: state.activeTurn.toolCalls,
        status: 'finished',
      };

      const newUsage = action.usage;
      const metrics = { ...state.metrics };
      if (newUsage) {
        metrics.totalInputTokens += newUsage.inputTokens;
        metrics.totalOutputTokens += newUsage.outputTokens;
        metrics.totalTokens += newUsage.totalTokens;
        if (metrics.contextWindow && metrics.contextWindow > 0) {
          metrics.contextPercentage = Math.round(
            (metrics.totalTokens / metrics.contextWindow) * 100,
          );
        }
      }

      return {
        ...state,
        status: 'idle',
        history: [...state.history, completed],
        activeTurn: null,
        metrics,
      };
    }

    case 'ERROR_TURN': {
      if (!state.activeTurn) {
        return { ...state, status: 'idle' };
      }

      const errored: CompletedTurn = {
        id: state.activeTurn.id,
        userPrompt: state.activeTurn.userPrompt,
        userTimestamp: state.activeTurn.userTimestamp,
        reasoning: state.activeTurn.reasoning || undefined,
        reasoningDurationMs: state.activeTurn.reasoningDurationMs,
        text: state.activeTurn.text,
        toolCalls: state.activeTurn.toolCalls,
        status: 'error',
        errorMessage: action.message,
      };

      return {
        ...state,
        status: 'idle',
        history: [...state.history, errored],
        activeTurn: null,
      };
    }

    case 'ABORT_TURN': {
      if (!state.activeTurn) {
        return { ...state, status: 'idle' };
      }

      const aborted: CompletedTurn = {
        id: state.activeTurn.id,
        userPrompt: state.activeTurn.userPrompt,
        userTimestamp: state.activeTurn.userTimestamp,
        reasoning: state.activeTurn.reasoning || undefined,
        reasoningDurationMs: state.activeTurn.reasoningDurationMs,
        text: state.activeTurn.text,
        toolCalls: state.activeTurn.toolCalls,
        status: 'aborted',
      };

      return {
        ...state,
        status: 'idle',
        history: [...state.history, aborted],
        activeTurn: null,
      };
    }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        history: [],
      };

    case 'NEW_SESSION':
      return {
        ...state,
        history: [],
        activeTurn: null,
        metrics: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
        },
        threadDoc: undefined,
      };

    case 'LOAD_THREAD':
      return {
        ...state,
        history: action.history,
        activeTurn: null,
        modelRef: action.modelRef ?? state.modelRef,
        metrics: action.metrics ? { ...state.metrics, ...action.metrics } : state.metrics,
        threadDoc: action.threadDoc ?? state.threadDoc,
      };

    case 'SET_PERMISSION_REQUEST':
      return {
        ...state,
        permissionRequest: action.request,
        status: action.request ? 'waiting_permission' : state.activeTurn ? 'running' : 'idle',
      };

    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          ...action.metrics,
        },
      };

    case 'SET_THREAD_DOC':
      return {
        ...state,
        threadDoc: action.threadDoc,
      };

    default:
      return state;
  }
}
