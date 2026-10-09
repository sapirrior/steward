/**
 * @file BashTool.ts
 * @description High-performance command execution tool integrating the unified Basher subsystem.
 * Supports safety classification (0 = Safe, 1 = Mutating/Unknown), real-time delta streaming,
 * automatic background handoff for long-running processes (15s budget), and permission checks.
 */

import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS, DEFAULT_BASH_TIMEOUT_MS, DEFAULT_BASH_FOREGROUND_BUDGET_MS } from '../../constants/index.js';
import {
  classifyCommand,
  runBash,
  taskManager,
  type CommandSafety,
} from '../../services/basher/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const FOREGROUND_BLOCKING_BUDGET_MS = DEFAULT_BASH_FOREGROUND_BUDGET_MS; // 8s foreground budget before auto-backgrounding

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const BashSchema = z.object({
  command: z.string().describe('The shell command to execute in the system terminal.'),
  timeout: z
    .number()
    .int()
    .min(1000)
    .max(600000)
    .optional()
    .describe('Optional execution timeout or foreground handoff limit in milliseconds. Defaults to 15,000ms.'),
  runInBackground: z
    .boolean()
    .optional()
    .describe('Set to true to immediately spawn this command as an asynchronous background task.'),
  description: z
    .string()
    .optional()
    .describe('Optional concise summary of what this command accomplishes.'),
});

export type BashInput = z.infer<typeof BashSchema>;

export interface BashData {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
  safety: CommandSafety;
  isBackground: boolean;
  autoBackgrounded?: boolean;
  taskId?: string;
  logPath?: string;
  killed?: boolean;
}

// ─── BashTool Implementation ──────────────────────────────────────────────────

export class BashTool extends Tool<BashInput, BashData> {
  readonly name = 'bash';
  readonly glyph = TOOL_GLYPHS.bash;
  readonly description =
    'Execute shell commands in the workspace terminal with live output streaming, automatic safety classification, and automatic background transition for long-running processes.';
  readonly schema = BashSchema;
  override readonly isDangerous = true;

  async execute(params: BashInput, context: ToolContext): Promise<ToolExecutionResult<BashData>> {
    const threadId = context.threadId || 'default';
    const classification = classifyCommand(params.command);

    // Permission check for mutating/unknown commands (Score = 1)
    if (classification.score === 1 && context.askPermission) {
      const allowed = await context.askPermission({
        toolName: this.name,
        action: 'Execute shell command',
        command: params.command,
        reason: classification.reasons.join('; ') || 'Mutating or unknown command',
      });

      if (!allowed) {
        return this.error(
          `Permission denied by user for command '${params.command}' (${classification.reasons.join('; ') || 'Mutating command'})`
        );
      }
    }

    // 1. Explicit background request
    if (params.runInBackground) {
      const execution = taskManager.createExecution({
        command: params.command,
        cwd: context.cwd,
        sessionId: threadId,
      });

      execution.start({ handoffDeadlineMs: 0 }); // 0 means immediately background

      const message = `Command spawned in background [Task ID: ${execution.taskId}].\nLogs streaming to: ${execution.outputPath}\nUse task manager to monitor or manage this task.`;
      const badge = `bash: [bg: ${execution.taskId}] ${params.command}`;

      return this.success(
        message,
        {
          command: params.command,
          exitCode: null,
          stdout: message,
          stderr: '',
          output: message,
          durationMs: 0,
          safety: classification.score,
          isBackground: true,
          taskId: execution.taskId,
          logPath: execution.outputPath,
        },
        badge,
        {
          taskId: execution.taskId,
          isBackground: true,
        }
      );
    }

    // 2. Foreground execution with auto-background handoff
    try {
      const handoffDeadline = params.timeout ?? FOREGROUND_BLOCKING_BUDGET_MS;

      const result = await runBash(params.command, {
        cwd: context.cwd,
        sessionId: threadId,
        handoffDeadlineMs: handoffDeadline,
        signal: context.signal,
        onStdoutChunk: (chunk) => {
          if (context.onProgress) {
            context.onProgress({
              type: 'delta',
              delta: chunk,
            });
          }
        },
        onStderrChunk: (chunk) => {
          if (context.onProgress) {
            context.onProgress({
              type: 'delta',
              delta: chunk,
            });
          }
        },
      });

      // Handle Auto-Background Transition
      if (result.outcome === 'backgrounded') {
        const taskSnapshot = taskManager.get(result.taskId);
        const logPath = taskSnapshot?.outputPath || `~/.steward/tasks/${threadId}/${result.taskId}.log`;

        const message = [
          `Command exceeded foreground execution threshold (${(result.durationMs / 1000).toFixed(1)}s) and was moved to the background.`,
          `Task ID: ${result.taskId}`,
          `Logs are streaming to: ${logPath}`,
          `Recent output:\n${result.stdout.slice(-1000) || '(Running...)'}`,
        ].join('\n');

        const badge = `bash: [moved to bg: ${result.taskId}] ${params.command} (${result.durationMs}ms)`;

        return this.success(
          message,
          {
            command: params.command,
            exitCode: null,
            stdout: result.stdout,
            stderr: result.stderr,
            output: message,
            durationMs: result.durationMs,
            safety: classification.score,
            isBackground: true,
            autoBackgrounded: true,
            taskId: result.taskId,
            logPath,
          },
          badge,
          {
            taskId: result.taskId,
            autoBackgrounded: true,
          }
        );
      }

      // Normal completion
      const isSuccess = result.exitCode === 0 && !result.killed;
      let finalOutput = result.combined.trim();

      if (result.killed) {
        finalOutput += '\n[Command was aborted before completion]';
      } else if (result.exitCode !== 0) {
        finalOutput += `\n[Command exited with error code ${result.exitCode}]`;
      }

      if (!finalOutput) {
        finalOutput = '(No output produced)';
      }

      const badge = `bash: ${params.command} [exit: ${result.exitCode ?? 1}] (${result.durationMs}ms)`;

      if (!isSuccess) {
        return {
          success: false,
          output: finalOutput,
          error: `Process exited with code ${result.exitCode}`,
          badge,
          data: {
            command: params.command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            output: finalOutput,
            durationMs: result.durationMs,
            safety: classification.score,
            isBackground: false,
            killed: result.killed,
          },
        };
      }

      return this.success(
        finalOutput,
        {
          command: params.command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
          output: finalOutput,
          durationMs: result.durationMs,
          safety: classification.score,
          isBackground: false,
          killed: result.killed,
        },
        badge,
        {
          exitCode: result.exitCode,
          durationMs: result.durationMs,
        }
      );
    } catch (err) {
      return this.error(`Execution failed for '${params.command}'`, err);
    }
  }

  override formatBadge(params: BashInput, result?: ToolExecutionResult<BashData>): string {
    if (result?.badge) return result.badge;
    return `bash: ${params.command}`;
  }
}
