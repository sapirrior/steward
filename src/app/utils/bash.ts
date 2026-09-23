import { spawn, type ChildProcess } from 'node:child_process';
import { getPlatformShell } from '@steward/services/tasks/shell.js';

export interface ExecuteDirectBashOptions {
  command: string;
  cwd?: string;
  abortSignal?: AbortSignal;
  onChunk?: (chunk: string, fullOutput: string) => void;
}

export interface DirectBashResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
}

/**
 * Executes a direct user shell command (e.g. `! ls -la`) with real-time output streaming.
 * Completely bypasses LLM turn history and persistent checkpoints.
 */
export async function executeDirectBash(
  options: ExecuteDirectBashOptions,
): Promise<DirectBashResult> {
  const { command, cwd = process.cwd(), abortSignal, onChunk } = options;
  const { shell, args } = getPlatformShell();
  const childArgs = [...args, command];
  const startTime = performance.now();

  return new Promise<DirectBashResult>((resolve, reject) => {
    let child: ChildProcess | null = null;
    let stdout = '';
    let stderr = '';
    let output = '';
    let isSettled = false;

    try {
      child = spawn(shell, childArgs, {
        cwd,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
    } catch (err) {
      return reject(err);
    }

    const cleanup = () => {
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onAbort);
      }
    };

    const finish = (exitCode: number | null) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      const durationMs = Math.max(0, Math.round(performance.now() - startTime));
      resolve({
        command,
        exitCode,
        stdout,
        stderr,
        output: output.trim(),
        durationMs,
      });
    };

    const onAbort = () => {
      if (child && !isSettled) {
        try {
          if (process.platform !== 'win32' && child.pid) {
            process.kill(-child.pid, 'SIGKILL');
          } else {
            child.kill('SIGKILL');
          }
        } catch {}
      }
    };

    if (abortSignal) {
      if (abortSignal.aborted) {
        onAbort();
      } else {
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stdout += text;
      output += text;
      onChunk?.(text, output);
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      stderr += text;
      output += text;
      onChunk?.(text, output);
    });

    child.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    });

    child.on('close', (code) => finish(code));
    child.on('exit', (code) => finish(code));
  });
}
