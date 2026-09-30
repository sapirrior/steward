/**
 * @steward/plugins - External Command Execution Runtime
 */

import { spawn } from 'node:child_process';
import { getPlatformShell } from '@steward/services/tasks/shell.js';
import { getFilteredChildEnv } from '@steward/services/tasks/process.js';
import {
  MAX_HOOK_CONTEXT_CHARS,
  MAX_HOOK_INPUT_BYTES,
  MAX_HOOK_STDOUT_BYTES,
  MAX_HOOK_STDERR_BYTES,
  type CompiledHook,
  type HookEventPayload,
  type HookResult,
  type HookExecutionDiagnostic,
} from './types.js';

export interface ExecuteHookOptions {
  hook: CompiledHook;
  payload: HookEventPayload;
  abortSignal?: AbortSignal;
}

export interface ExecuteHookResult {
  result?: HookResult;
  diagnostic?: HookExecutionDiagnostic;
}

const BLOCKING_EVENTS = new Set(['UserPromptSubmit', 'BeforeToolUse', 'AgentStop']);

function killProcessTree(pid: number | undefined, child: ReturnType<typeof spawn>): void {
  if (!pid) return;

  try {
    child.stdin?.destroy();
  } catch {}

  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
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

/**
 * Executes a single compiled hook (external command or built-in handler) safely.
 */
export async function executeHook(options: ExecuteHookOptions): Promise<ExecuteHookResult> {
  const { hook, payload, abortSignal } = options;

  // 1. Built-in hook fast-path
  if (hook.builtinHandler) {
    try {
      const result = await hook.builtinHandler(payload);
      return { result };
    } catch (err: any) {
      return {
        diagnostic: {
          hookName: hook.name,
          source: hook.source,
          event: hook.event,
          error: `Built-in hook threw error: ${err.message}`,
        },
      };
    }
  }

  // 2. Abort check before spawn
  if (abortSignal?.aborted) {
    return {
      diagnostic: {
        hookName: hook.name,
        source: hook.source,
        event: hook.event,
        error: 'Execution aborted before spawning.',
      },
    };
  }

  // 3. Serialize payload bounded by MAX_HOOK_INPUT_BYTES
  let serializedPayload: string;
  try {
    serializedPayload = JSON.stringify(payload);
  } catch (err: any) {
    return {
      diagnostic: {
        hookName: hook.name,
        source: hook.source,
        event: hook.event,
        error: `Failed to serialize payload: ${err.message}`,
      },
    };
  }

  if (Buffer.byteLength(serializedPayload, 'utf-8') > MAX_HOOK_INPUT_BYTES) {
    return {
      diagnostic: {
        hookName: hook.name,
        source: hook.source,
        event: hook.event,
        error: `Payload exceeds max input limit of ${MAX_HOOK_INPUT_BYTES} bytes.`,
      },
    };
  }

  // 4. Setup environment variables
  const env: NodeJS.ProcessEnv = {
    ...getFilteredChildEnv(),
    STEWARD_PROJECT_DIR: payload.project_dir,
    STEWARD_CWD: payload.cwd,
    STEWARD_SESSION_ID: payload.session_id,
    STEWARD_TURN_ID: payload.turn_id ?? '',
    STEWARD_HOOK_EVENT: payload.hook_event_name,
    STEWARD_HOOK_NAME: hook.name,
  };

  const { shell, args } = getPlatformShell();
  const childArgs = [...args, hook.command];

  return new Promise<ExecuteHookResult>((resolve) => {
    let child: ReturnType<typeof spawn>;
    let timer: NodeJS.Timeout | null = null;
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let hasExited = false;
    let abortListener: (() => void) | null = null;

    try {
      child = spawn(shell, childArgs, {
        cwd: payload.project_dir,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
    } catch (err: any) {
      return resolve({
        diagnostic: {
          hookName: hook.name,
          source: hook.source,
          event: hook.event,
          error: `Failed to spawn process: ${err.message}`,
        },
      });
    }

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (abortListener && abortSignal) {
        abortSignal.removeEventListener('abort', abortListener);
        abortListener = null;
      }
    };

    // Timeout handling
    timer = setTimeout(() => {
      if (hasExited) return;
      hasExited = true;
      cleanup();
      killProcessTree(child.pid, child);
      resolve({
        diagnostic: {
          hookName: hook.name,
          source: hook.source,
          event: hook.event,
          error: `Hook timed out after ${hook.timeoutMs}ms.`,
          stderr: stderrBuffer,
        },
      });
    }, hook.timeoutMs);

    // Abort signal handling
    if (abortSignal) {
      abortListener = () => {
        if (hasExited) return;
        hasExited = true;
        cleanup();
        killProcessTree(child.pid, child);
        resolve({
          diagnostic: {
            hookName: hook.name,
            source: hook.source,
            event: hook.event,
            error: 'Hook execution aborted by signal.',
            stderr: stderrBuffer,
          },
        });
      };
      abortSignal.addEventListener('abort', abortListener, { once: true });
    }

    child.stdin?.on('error', () => {});
    child.stdout?.on('error', () => {});
    child.stderr?.on('error', () => {});

    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdoutBuffer.length < MAX_HOOK_STDOUT_BYTES) {
        stdoutBuffer += chunk.toString('utf-8');
        if (stdoutBuffer.length > MAX_HOOK_STDOUT_BYTES) {
          stdoutBuffer = stdoutBuffer.slice(0, MAX_HOOK_STDOUT_BYTES);
        }
      }
    });

    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderrBuffer.length < MAX_HOOK_STDERR_BYTES) {
        stderrBuffer += chunk.toString('utf-8');
        if (stderrBuffer.length > MAX_HOOK_STDERR_BYTES) {
          stderrBuffer = stderrBuffer.slice(0, MAX_HOOK_STDERR_BYTES);
        }
      }
    });

    // Write input payload and close stdin
    try {
      child.stdin?.write(serializedPayload, 'utf-8', () => {
        try {
          child.stdin?.end();
        } catch {}
      });
    } catch {
      try {
        child.stdin?.end();
      } catch {}
    }

    const onExit = (code: number | null) => {
      if (hasExited) return;
      hasExited = true;
      cleanup();

      const trimmedStdout = stdoutBuffer.trim();
      const trimmedStderr = stderrBuffer.trim();

      // 1. Try parsing JSON stdout if present
      let parsedJsonResult: HookResult | undefined;
      let jsonParseError: string | undefined;

      if (trimmedStdout.length > 0) {
        try {
          const parsed = JSON.parse(trimmedStdout);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const decision =
              parsed.decision === 'block' || parsed.decision === 'allow'
                ? parsed.decision
                : undefined;
            const reason = typeof parsed.reason === 'string' ? parsed.reason : undefined;
            let additionalContext =
              typeof parsed.additionalContext === 'string' ? parsed.additionalContext : undefined;

            if (additionalContext && additionalContext.length > MAX_HOOK_CONTEXT_CHARS) {
              additionalContext = additionalContext.slice(0, MAX_HOOK_CONTEXT_CHARS);
            }

            parsedJsonResult = {
              decision,
              reason,
              additionalContext,
            };
          } else {
            jsonParseError = 'Stdout was not a valid JSON object.';
          }
        } catch (err: any) {
          jsonParseError = `Failed to parse stdout JSON: ${err.message}`;
        }
      }

      // Exit code 0
      if (code === 0) {
        if (jsonParseError) {
          return resolve({
            diagnostic: {
              hookName: hook.name,
              source: hook.source,
              event: hook.event,
              error: jsonParseError,
              exitCode: code,
              stderr: trimmedStderr,
            },
          });
        }
        return resolve({ result: parsedJsonResult ?? {} });
      }

      // Exit code 2 (explicit block on blocking events)
      if (code === 2 && BLOCKING_EVENTS.has(payload.hook_event_name)) {
        if (parsedJsonResult && parsedJsonResult.decision === 'block') {
          return resolve({ result: parsedJsonResult });
        }

        const blockReason =
          parsedJsonResult?.reason ||
          (trimmedStderr.length > 0
            ? trimmedStderr.slice(0, 500)
            : `Hook "${hook.name}" blocked the action.`);

        return resolve({
          result: {
            decision: 'block',
            reason: blockReason,
            additionalContext: parsedJsonResult?.additionalContext,
          },
          diagnostic: trimmedStderr
            ? {
                hookName: hook.name,
                source: hook.source,
                event: hook.event,
                error: `Hook exited with code 2: ${trimmedStderr}`,
                exitCode: code,
                stderr: trimmedStderr,
              }
            : undefined,
        });
      }

      // Nonzero exit code error
      return resolve({
        diagnostic: {
          hookName: hook.name,
          source: hook.source,
          event: hook.event,
          error:
            trimmedStderr.length > 0
              ? `Hook exited with code ${code}: ${trimmedStderr}`
              : `Hook exited with code ${code}.`,
          exitCode: code,
          stderr: trimmedStderr,
        },
      });
    };

    child.on('exit', (code) => onExit(code));
    child.on('close', (code) => onExit(code));
    child.on('error', (err) => {
      if (hasExited) return;
      hasExited = true;
      cleanup();
      resolve({
        diagnostic: {
          hookName: hook.name,
          source: hook.source,
          event: hook.event,
          error: `Process execution error: ${err.message}`,
        },
      });
    });
  });
}
