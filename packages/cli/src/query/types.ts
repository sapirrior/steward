import type {
  ProviderId,
  ReasoningEffort,
  ModelSelection,
  TokenUsage,
  Message,
  PortError,
  ToolSpec,
} from '@steward/ai';
import type {
  ToolContext,
  BashPermissionRequest,
  FilePermissionRequest,
  BashPermissionResponse,
  FilePermissionResponse,
} from '../tools/types.js';

export type { ProviderId, ReasoningEffort, ModelSelection, TokenUsage, Message, PortError };

export interface SubmitPromptOptions {
  cwd?: string;
  requestBashPermission?: (req: BashPermissionRequest) => Promise<BashPermissionResponse>;
  requestFilePermission?: (req: FilePermissionRequest) => Promise<FilePermissionResponse>;
  tools?: readonly ToolSpec[] | ((ctx: ToolContext) => readonly ToolSpec[]);
  extraInstructions?: string;
  onEvent?: AgentEventListener;
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultInfo extends ToolCallInfo {
  result: unknown;
  isError: boolean;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
}

export type AgentMessage = Message;

export interface SessionConfig {
  provider: ProviderId;
  modelId: string;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  maxSteps?: number;
}

export type TurnStopReason = 'natural' | 'step-limit' | 'aborted' | 'error';

export interface TurnSummary {
  text: string;
  reasoning?: string;
  toolCalls: ToolResultInfo[];
  usage: TokenUsage;
  finishReason: string;
  stopReason?: TurnStopReason;
  rawMessages?: Message[];
  error?: PortError;
  durationMs?: number;
  startedAt?: string;
  finishedAt?: string;
  statusVerb?: string;
}

export type AgentTurnEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; reasoning: string }
  | { type: 'tool-call'; toolCall: ToolCallInfo }
  | { type: 'tool-result'; toolResult: ToolResultInfo }
  | { type: 'step-end'; stepIndex: number; usage?: TokenUsage }
  | {
      type: 'retry';
      attempt: number;
      maxAttempts: number;
      delayMs: number;
      error: Error | PortError;
    }
  | { type: 'turn-complete'; summary: TurnSummary }
  | { type: 'error'; error: Error; isFatal: boolean };

export type AgentEventListener = (event: AgentTurnEvent) => void;
