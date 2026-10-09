import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, type WriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import type { ShellTaskStatus } from './types.js';

export const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB hard cap on disk output
export const MAX_MEMORY_BUFFER_BYTES = 500 * 1024; // 500 KB memory buffer tail
export const DEFAULT_HANDOFF_DEADLINE_MS = 12_000; // 12 seconds

export const PROVIDER_SECRET_ENV_KEYS: readonly string[] = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'OPENAI_API_KEY',
  'XAI_API_KEY',
  'MISTRAL_API_KEY',
  'DEEPSEEK_API_KEY',
  'OPENROUTER_API_KEY',
  'CUSTOM_API_KEY',
] as const;

export function getFilteredChildEnv(extraEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const env = { ...process.env, ...extraEnv };
  for (const key of PROVIDER_SECRET_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

export function getPlatformShell(): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return {
      shell: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c'],
    };
  }
  const shell = process.env.SHELL || '/bin/bash';
  return { shell, args: ['-c'] };
}

export interface ShellExecutionOptions {
  taskId: string;
  command: string;
  cwd: string;
  sessionId?: string;
  env?: Record<string, string>;
  abortSignal?: AbortSignal;
  handoffDeadlineMs?: number;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
}

export type ShellExecutionLifecycleState =
  | 'starting'
  | 'foreground'
  | 'background'
  | 'completed'
  | 'failed'
  | 'killed';

export class ShellExecution {
  public readonly taskId: string;
  public readonly command: string;
  public readonly cwd: string;
  public readonly startedAt: string;
  public endedAt?: string;
  public exitCode: number | null = null;
  public outputPath: string;
  public outputTruncated = false;

  private child: ChildProcess | null = null;
  private state: ShellExecutionLifecycleState = 'starting';
  private totalBytesWritten = 0;
  private memoryBuffer: string[] = [];
  private memoryBufferLength = 0;
  private fileStream: WriteStream | null = null;
  private abortListener: (() => void) | null = null;
  private handoffTimer: NodeJS.Timeout | null = null;
  private stdinClosed = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private exitResolvers: Array<() => void> = [];
  private env?: Record<string, string>;
  private onStdoutChunk?: (chunk: string) => void;
  private onStderrChunk?: (chunk: string) => void;
  private onLine?: (line: string, stream: 'stdout' | 'stderr') => void;
  private lineBuffer = '';

  constructor(options: ShellExecutionOptions) {
    this.taskId = options.taskId;
    this.command = options.command;
    this.cwd = options.cwd;
    this.env = options.env;
    this.onStdoutChunk = options.onStdoutChunk;
    this.onStderrChunk = options.onStderrChunk;
    this.onLine = options.onLine;
    this.startedAt = new Date().toISOString();

    const taskDir = join(homedir(), '.steward', 'tasks', options.sessionId || 'default');
    try {
      mkdirSync(taskDir, { recursive: true });
      this.outputPath = join(taskDir, `${this.taskId}.log`);
    } catch {
      const fallbackDir = join(tmpdir(), 'steward-tasks');
      mkdirSync(fallbackDir, { recursive: true });
      this.outputPath = join(fallbackDir, `${this.taskId}.log`);
    }
  }

  public get status(): ShellTaskStatus {
    switch (this.state) {
      case 'starting':
      case 'foreground':
      case 'background':
        return 'running';
      case 'completed':
        return 'completed';
      case 'failed':
        return 'failed';
      case 'killed':
        return 'killed';
    }
  }

  public get isRunning(): boolean {
    return this.state === 'starting' || this.state === 'foreground' || this.state === 'background';
  }

  public get isStdinOpen(): boolean {
    return this.isRunning && !this.stdinClosed;
  }

  public get pid(): number | undefined {
    return this.child?.pid;
  }

  public start(options: { abortSignal?: AbortSignal; handoffDeadlineMs?: number } = {}): {
    foregroundPromise: Promise<{
      outcome: 'exited' | 'backgrounded';
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
    }>;
  } {
    const { shell, args } = getPlatformShell();
    const childArgs = [...args, this.command];

    try {
      this.fileStream = createWriteStream(this.outputPath, { flags: 'a', mode: 0o600 });
      this.fileStream.on('error', () => {});
    } catch {
      this.fileStream = null;
    }

    const child = spawn(shell, childArgs, {
      cwd: this.cwd,
      env: getFilteredChildEnv(this.env),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    this.child = child;
    this.state = 'foreground';
    const startTime = Date.now();

    child.stdin?.on('error', () => {});
    child.stdout?.on('error', () => {});
    child.stderr?.on('error', () => {});

    let stdoutChunks = '';
    let stderrChunks = '';

    const handleChunk = (chunk: Buffer, isStderr: boolean) => {
      const text = chunk.toString('utf-8');
      if (isStderr) {
        stderrChunks += text;
        this.onStderrChunk?.(text);
      } else {
        stdoutChunks += text;
        this.onStdoutChunk?.(text);
      }

      if (this.onLine) {
        this.lineBuffer += text;
        const lines = this.lineBuffer.split(/\r?\n/);
        this.lineBuffer = lines.pop() || '';
        for (const line of lines) {
          this.onLine(line, isStderr ? 'stderr' : 'stdout');
        }
      }

      if (this.totalBytesWritten + chunk.length > MAX_OUTPUT_BYTES) {
        this.outputTruncated = true;
        const allowed = Math.max(0, MAX_OUTPUT_BYTES - this.totalBytesWritten);
        if (allowed > 0) {
          const slice = chunk.subarray(0, allowed);
          this.totalBytesWritten += allowed;
          this.appendMemoryBuffer(slice.toString('utf-8'));
          this.fileStream?.write(slice);
        }
        return;
      }

      this.totalBytesWritten += chunk.length;
      this.appendMemoryBuffer(text);
      this.fileStream?.write(chunk);
    };

    child.stdout?.on('data', (chunk: Buffer) => handleChunk(chunk, false));
    child.stderr?.on('data', (chunk: Buffer) => handleChunk(chunk, true));

    const onExit = (code: number | null, _signal: string | null) => {
      if (!this.isRunning) return;

      this.endedAt = new Date().toISOString();
      this.exitCode = code;
      this.stdinClosed = true;

      if (this.state === 'killed') {
        // already marked killed
      } else if (code === 0) {
        this.state = 'completed';
      } else {
        this.state = 'failed';
      }

      if (this.onLine && this.lineBuffer.trim()) {
        this.onLine(this.lineBuffer, 'stdout');
        this.lineBuffer = '';
      }

      this.cleanupStreams();
      this.resolveExitWaiters();
    };

    child.on('exit', (code, signal) => onExit(code, signal));
    child.on('close', (code, signal) => onExit(code, signal));

    child.on('error', (err) => {
      if (!this.isRunning) return;
      this.endedAt = new Date().toISOString();
      this.exitCode = 1;
      this.stdinClosed = true;
      this.state = 'failed';
      this.appendMemoryBuffer(`\nProcess error: ${err.message}\n`);
      this.cleanupStreams();
      this.resolveExitWaiters();
    });

    const deadline = options.handoffDeadlineMs ?? DEFAULT_HANDOFF_DEADLINE_MS;

    const foregroundPromise = new Promise<{
      outcome: 'exited' | 'backgrounded';
      exitCode: number | null;
      stdout: string;
      stderr: string;
      durationMs: number;
    }>((resolve, reject) => {
      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          this.killTree();
          return reject(new Error('Command aborted before execution.'));
        }

        this.abortListener = () => {
          if (this.state === 'foreground') {
            this.killTree();
            reject(new Error('Command execution aborted by user.'));
          }
        };
        options.abortSignal.addEventListener('abort', this.abortListener, { once: true });
      }

      if (deadline > 0) {
        this.handoffTimer = setTimeout(() => {
          this.handoffTimer = null;
          if (this.state === 'foreground') {
            this.state = 'background';
            this.detachAbortListener(options.abortSignal);
            resolve({
              outcome: 'backgrounded',
              exitCode: null,
              stdout: stdoutChunks,
              stderr: stderrChunks,
              durationMs: Date.now() - startTime,
            });
          }
        }, deadline);
      }

      const checkExit = () => {
        if (this.state === 'completed' || this.state === 'failed' || this.state === 'killed') {
          if (this.handoffTimer) {
            clearTimeout(this.handoffTimer);
            this.handoffTimer = null;
          }
          this.detachAbortListener(options.abortSignal);

          resolve({
            outcome: 'exited',
            exitCode: this.exitCode,
            stdout: stdoutChunks,
            stderr: stderrChunks,
            durationMs: Date.now() - startTime,
          });
        }
      };

      this.exitResolvers.push(checkExit);
      if (!this.isRunning) {
        checkExit();
      }
    });

    return { foregroundPromise };
  }

  private appendMemoryBuffer(text: string): void {
    this.memoryBuffer.push(text);
    this.memoryBufferLength += text.length;

    while (this.memoryBufferLength > MAX_MEMORY_BUFFER_BYTES && this.memoryBuffer.length > 1) {
      const removed = this.memoryBuffer.shift();
      if (removed) {
        this.memoryBufferLength -= removed.length;
      }
    }
  }

  private detachAbortListener(abortSignal?: AbortSignal): void {
    if (abortSignal && this.abortListener) {
      abortSignal.removeEventListener('abort', this.abortListener);
      this.abortListener = null;
    }
  }

  private resolveExitWaiters(): void {
    const waiters = [...this.exitResolvers];
    this.exitResolvers = [];
    for (const w of waiters) {
      w();
    }
  }

  private cleanupStreams(): void {
    if (this.handoffTimer) {
      clearTimeout(this.handoffTimer);
      this.handoffTimer = null;
    }
    if (this.fileStream) {
      try {
        this.fileStream.end();
      } catch {}
      this.fileStream = null;
    }
  }

  public getRecentOutput(): string {
    return this.memoryBuffer.join('');
  }

  public async sendInput(input: string): Promise<number> {
    if (!this.isRunning) {
      throw new Error(`Task "${this.taskId}" is not running (status: ${this.status}).`);
    }
    if (this.stdinClosed || !this.child?.stdin?.writable) {
      throw new Error(`Standard input for task "${this.taskId}" is closed.`);
    }

    return new Promise<number>((resolve, reject) => {
      this.writeQueue = this.writeQueue
        .catch(() => {})
        .then(async () => {
          if (!this.isRunning || this.stdinClosed || !this.child?.stdin?.writable) {
            return reject(
              new Error(`Task "${this.taskId}" stdin is not writable (status: ${this.status}).`),
            );
          }

          const buf = Buffer.from(input, 'utf-8');
          try {
            this.child.stdin.write(buf, (err) => {
              if (err) {
                reject(new Error(`Failed to write to stdin: ${err.message}`));
              } else {
                resolve(buf.length);
              }
            });
          } catch (err: any) {
            reject(new Error(`Failed to write to stdin: ${err.message}`));
          }
        });
    });
  }

  public async kill(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.state = 'killed';
    this.endedAt = new Date().toISOString();
    this.stdinClosed = true;

    this.killTree();
    this.cleanupStreams();
    this.resolveExitWaiters();
  }

  private killTree(): void {
    const child = this.child;
    if (!child) return;

    try {
      child.stdin?.destroy();
    } catch {}

    const pid = child.pid;
    if (!pid) return;

    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
          stdio: 'ignore',
        });
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch (err: any) {
        if (err.code !== 'ESRCH') {
          try {
            child.kill('SIGKILL');
          } catch {}
        }
      }
      try {
        child.kill('SIGKILL');
      } catch {}
    }
  }
}
