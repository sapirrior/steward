import type { BashExecutionOptions, BashExecutionResult } from './types.js';
import { taskManager } from './taskManager.js';
import { DEFAULT_BASH_TIMEOUT_MS } from '../../constants/index.js';

/**
 * High-level bash execution runner integrating real-time streaming,
 * timeout handling, and automatic background handoff.
 */
export async function runBash(
  command: string,
  options: BashExecutionOptions = {},
): Promise<BashExecutionResult> {
  const cwd = options.cwd ?? process.cwd();
  const handoffDeadlineMs = options.handoffDeadlineMs ?? DEFAULT_BASH_TIMEOUT_MS;

  const execution = taskManager.createExecution({
    command,
    cwd,
    sessionId: options.sessionId,
    env: options.env,
    onStdoutChunk: options.onStdoutChunk,
    onStderrChunk: options.onStderrChunk,
    onLine: options.onLine,
  });

  try {
    const { foregroundPromise } = execution.start({
      abortSignal: options.signal,
      handoffDeadlineMs,
    });

    const result = await foregroundPromise;
    const combined = [result.stdout, result.stderr].filter(Boolean).join('\n');

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      combined,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      outcome: result.outcome,
      taskId: execution.taskId,
      killed: execution.status === 'killed',
      timedOut: false,
    };
  } catch (err: any) {
    const isAborted = options.signal?.aborted || err.message?.includes('aborted');
    return {
      stdout: execution.getRecentOutput(),
      stderr: err.message || 'Execution error',
      combined: err.message || 'Execution error',
      exitCode: isAborted ? 130 : 1,
      durationMs: 0,
      outcome: 'exited',
      taskId: execution.taskId,
      killed: isAborted,
      timedOut: false,
    };
  }
}
