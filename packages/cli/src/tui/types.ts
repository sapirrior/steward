import type { ModelRef } from '@steward/models';
import type { ModelMessage, ThreadDoc, ThreadUsage } from '@steward/threads';
import type { ReasoningEffort } from '../agent/types.js';
import type { StewardSettings } from '../settings/settingsTypes.js';
import type { Theme } from '../themes/themeTypes.js';

export type TuiStatus = 'idle' | 'running' | 'waiting_permission' | 'exiting';

export interface ActiveToolCallState {
  toolCallId: string;
  toolName: string;
  tagline: string;
  args: Record<string, unknown>;
  status: 'running' | 'success' | 'error';
  result?: unknown;
  durationMs?: number;
  isError?: boolean;
}

export interface ActiveTurnState {
  id: string;
  userPrompt: string;
  userTimestamp: string;
  reasoning: string;
  reasoningDurationMs?: number;
  text: string;
  toolCalls: ActiveToolCallState[];
  status: 'running' | 'finished' | 'error' | 'aborted';
  errorMessage?: string;
  retryAttempt?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  abortController?: AbortController;
}

export interface CompletedTurn {
  id: string;
  userPrompt: string;
  userTimestamp: string;
  reasoning?: string;
  reasoningDurationMs?: number;
  text: string;
  toolCalls: ActiveToolCallState[];
  status: 'finished' | 'error' | 'aborted';
  errorMessage?: string;
  durationMs?: number;
}

export interface TuiMetrics {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  contextWindow?: number;
  contextPercentage?: number;
  estimatedCostUsd: number;
}

export interface PermissionRequestState {
  toolName: string;
  command: string;
  tagline: string;
  resolve: (approved: boolean) => void;
}

export interface AppState {
  settings: StewardSettings;
  theme: Theme;
  modelRef: ModelRef;
  reasoningEffort: ReasoningEffort;
  status: TuiStatus;
  history: CompletedTurn[];
  activeTurn: ActiveTurnState | null;
  metrics: TuiMetrics;
  permissionRequest: PermissionRequestState | null;
  threadDoc?: ThreadDoc;
  gitBranch?: string;
  cwd: string;
  expandAllBashCards?: boolean;
}

export type AppStateAction =
  | { type: 'SET_STATUS'; status: TuiStatus }
  | { type: 'SET_MODEL'; modelRef: ModelRef }
  | { type: 'SET_EFFORT'; effort: ReasoningEffort }
  | { type: 'SET_THEME'; theme: Theme }
  | { type: 'TOGGLE_EXPAND_ALL_BASH_CARDS' }
  | { type: 'START_TURN'; turn: ActiveTurnState }
  | { type: 'APPEND_REASONING'; text: string }
  | { type: 'FINISH_REASONING'; durationMs: number }
  | { type: 'APPEND_TEXT'; text: string }
  | { type: 'START_TOOL_CALL'; toolCall: ActiveToolCallState }
  | {
      type: 'FINISH_TOOL_CALL';
      toolCallId: string;
      result: unknown;
      durationMs: number;
      isError: boolean;
    }
  | {
      type: 'SET_RETRY';
      attempt: number;
      maxRetries: number;
      delayMs: number;
      errorMessage: string;
    }
  | { type: 'FINISH_TURN'; usage?: ThreadUsage }
  | { type: 'ERROR_TURN'; message: string }
  | { type: 'ABORT_TURN' }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'NEW_SESSION' }
  | {
      type: 'LOAD_THREAD';
      history: CompletedTurn[];
      modelRef?: ModelRef;
      metrics?: Partial<TuiMetrics>;
      threadDoc?: ThreadDoc;
    }
  | { type: 'SET_PERMISSION_REQUEST'; request: PermissionRequestState | null }
  | { type: 'UPDATE_METRICS'; metrics: Partial<TuiMetrics> }
  | { type: 'SET_THREAD_DOC'; threadDoc: ThreadDoc };
