import type { z } from 'zod';
import type {
  MutationCheckpointTracker,
  MutationLockManager,
} from '@steward/services/checkpoint/index.js';
import type { ShellTaskManager } from '@steward/services/tasks/manager.js';
import type { ChatMode } from '../policy/modes.js';
import type { DiffHunk } from '@steward/services/diff/diff.js';

export type ToolAccess = 'read' | 'write' | 'exec';

export type ToolDetail =
  | { kind: 'text'; text: string }
  | { kind: 'pre-styled'; text: string }
  | { kind: 'code'; filePath?: string; text: string; totalLines: number }
  | { kind: 'diff'; filePath?: string; hunks: DiffHunk[] };

export interface ToolSummary {
  headline: string;
  detail?: ToolDetail;
}

export interface BashPermissionRequest {
  command: string;
  explanation: string;
}

export interface BashPermissionResponse {
  allowed: boolean;
}

export type FilePermissionKind = 'create' | 'overwrite' | 'edit';

export interface FilePermissionRequest {
  kind: FilePermissionKind;
  filePath: string;
  before: string | null;
  after: string;
}

export interface FilePermissionResponse {
  allowed: boolean;
}

/**
 * Execution context passed to tools during execution.
 */
export interface ToolContext {
  cwd: string;
  mode?: ChatMode;
  sessionId?: string;
  abortSignal?: AbortSignal;
  checkpointTracker?: MutationCheckpointTracker;
  mutationLocks?: MutationLockManager;
  requestBashPermission?: (req: BashPermissionRequest) => Promise<BashPermissionResponse>;
  requestFilePermission?: (req: FilePermissionRequest) => Promise<FilePermissionResponse>;
  shellTasks?: ShellTaskManager;
}

/**
 * Clean, extensible tool definition contract.
 */
export interface ToolDefinition<TParams extends z.ZodTypeAny = z.ZodTypeAny, TResult = unknown> {
  name: string;
  displayName: string;
  icon?: string;
  description: string;
  access: ToolAccess;
  parameters: TParams;

  /**
   * Confirmation policy for the tool. Defaults to 'never'.
   */
  confirmationPolicy?: 'never';

  /**
   * Bounded summary of arguments for logging and session records.
   */
  summarizeArgs?: (args: z.infer<TParams>) => string;

  /**
   * Main tool execution function.
   */
  execute: (args: z.infer<TParams>, context: ToolContext) => Promise<TResult>;

  /**
   * Concise summary of the tool invocation for terminal logs and session history.
   */
  summarize?: (args: z.infer<TParams>, result?: TResult) => ToolSummary | string;
}
