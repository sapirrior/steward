export type SafetyScore = 0 | 1; // 0 = Safe / Read-Only (Auto-run), 1 = Not Safe / Mutating / Default-Deny (Needs Permission)

export type RiskCategory =
  | 'file-write'
  | 'file-delete'
  | 'file-modify'
  | 'redirection'
  | 'git-mutation'
  | 'package-install'
  | 'process-kill'
  | 'system-exec'
  | 'network-eval'
  | 'unknown-binary';

export type ShellTaskStatus = 'running' | 'completed' | 'failed' | 'killed';

export interface CommandSegment {
  raw: string;
  command: string;
  args: string[];
  redirections: string[];
  hasSubshell: boolean;
  subcommands: string[];
}

export interface BashCommandAnalysis {
  rawCommand: string;
  score: SafetyScore;
  isMutating: boolean;
  reasons: string[];
  categories: RiskCategory[];
  segments: CommandSegment[];
}

export interface BashExecutionOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  sessionId?: string;
  signal?: AbortSignal;
  handoffDeadlineMs?: number;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export interface BashExecutionResult {
  stdout: string;
  stderr: string;
  combined: string;
  exitCode: number | null;
  durationMs: number;
  outcome: 'exited' | 'backgrounded';
  taskId?: string;
  killed?: boolean;
  timedOut?: boolean;
}

export interface ShellTask {
  id: string;
  status: ShellTaskStatus;
  command: string;
  cwd: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  outputPath?: string;
  output: string;
  outputTruncated: boolean;
  stdinOpen: boolean;
  pid?: number;
}

export interface ShellTaskReadResult {
  id: string;
  status: ShellTaskStatus;
  command: string;
  cwd: string;
  startedAt: string;
  endedAt?: string;
  exitCode?: number | null;
  output: string;
  outputTruncated: boolean;
  stdinOpen: boolean;
}

export interface ShellTaskSendInputResult {
  id: string;
  status: ShellTaskStatus;
  bytesWritten: number;
  output: string;
  outputTruncated: boolean;
  message: string;
}

export interface ShellTaskKillResult {
  id: string;
  status: ShellTaskStatus;
  command: string;
  message: string;
}
