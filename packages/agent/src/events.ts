/**
 * @steward/agent - Generic Agent Lifecycle Events
 */

import type {
  AgentRunResult,
  Message,
  StreamError,
  StreamEvent,
  TokenUsage,
  ToolCallContent,
  ToolResult,
} from './types.js';

export type AgentEvent =
  | { type: 'agent-start' }
  | { type: 'turn-start'; step: number }
  | { type: 'message-start'; message: Message }
  | { type: 'message-update'; message: Message; streamEvent: StreamEvent }
  | { type: 'message-end'; message: Message }
  | { type: 'tool-execution-start'; toolCall: ToolCallContent }
  | { type: 'tool-execution-update'; toolCallId: string; update: unknown }
  | { type: 'tool-execution-end'; toolCall: ToolCallContent; result: ToolResult }
  | { type: 'turn-end'; message: Message; toolResults: readonly ToolResult[]; usage?: TokenUsage }
  | { type: 'retry'; attempt: number; maxAttempts: number; delayMs: number; error: StreamError }
  | { type: 'agent-end'; result: AgentRunResult };

export type AgentEventListener = (event: AgentEvent) => void;
