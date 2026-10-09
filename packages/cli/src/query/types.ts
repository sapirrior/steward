import type { Message, TokenUsage, ToolResult, AgentRunStopReason } from '@steward/agent';
import type { ReasoningEffort } from '@steward/ai';
import type { ToolProgress, PermissionRequest } from '../tools/Tool.js';
import type { SettingsStore } from '../settings/settingsStore.js';
import type { ThreadStore } from '../threads/threadStore.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import type { AI } from '@steward/ai';

export interface QueryEngineConfig {
  cwd?: string;
  threadId?: string;
  initialMessages?: Message[];
  customSystemPrompt?: string;
  extraInstructions?: string;
  isHeadless?: boolean;
  maxSteps?: number;
  provider?: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  settingsStore?: SettingsStore;
  threadStore?: ThreadStore;
  toolRegistry?: ToolRegistry;
  ai?: AI;
  askPermission?: (request: PermissionRequest) => Promise<boolean>;
}

export type QueryEngineEvent =
  | { type: 'turn-start'; step: number }
  | { type: 'text-delta'; delta: string; accumulatedText: string }
  | { type: 'reasoning-delta'; delta: string; accumulatedReasoning: string }
  | { type: 'tool-call-start'; id: string; name: string; args: Record<string, unknown>; glyph: string; badge?: string }
  | { type: 'tool-progress'; id: string; progress: ToolProgress }
  | { type: 'tool-call-end'; id: string; name: string; result: ToolResult; glyph: string; badge?: string }
  | { type: 'turn-end'; step: number; toolResults: readonly ToolResult[]; usage?: TokenUsage }
  | { type: 'retry'; attempt: number; maxAttempts: number; delayMs: number; error: Error }
  | { type: 'done'; result: QueryTurnResult }
  | { type: 'error'; error: Error };

export interface QueryTurnResult {
  text: string;
  reasoning?: string;
  toolResults: readonly ToolResult[];
  newMessages: Message[];
  totalUsage: TokenUsage;
  stopReason: AgentRunStopReason;
  durationMs: number;
  error?: Error;
}
