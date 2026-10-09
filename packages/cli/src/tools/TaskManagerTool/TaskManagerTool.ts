/**
 * @file TaskManagerTool.ts
 * @description Tool for managing background shell tasks spawned by Basher.
 * Supports listing active tasks, reading logs, sending stdin input, and terminating processes.
 */

import { z } from 'zod';
import { Tool, type ToolContext, type ToolExecutionResult } from '../Tool.js';
import { TOOL_GLYPHS } from '../../constants/index.js';
import { taskManager } from '../../services/basher/index.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const TaskManagerSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('list').describe('List all active and recently completed background tasks.'),
  }),
  z.object({
    action: z.literal('read').describe('Read recent log output for a specific background task.'),
    taskId: z.string().describe('The unique task ID (e.g. "task-8f1a23").'),
    lines: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .describe('Number of recent log lines to return. Defaults to 50.'),
  }),
  z.object({
    action: z.literal('send_input').describe('Send standard input text to a running background task.'),
    taskId: z.string().describe('The unique task ID of the running task.'),
    input: z.string().describe('The text string to send to standard input (include newline if submitting a line).'),
  }),
  z.object({
    action: z.literal('kill').describe('Terminate a background task process tree immediately.'),
    taskId: z.string().describe('The unique task ID of the task to terminate.'),
  }),
]);

export type TaskManagerInput = z.infer<typeof TaskManagerSchema>;

export interface TaskManagerData {
  action: 'list' | 'read' | 'send_input' | 'kill';
  summary: string;
  tasks?: Array<{
    id: string;
    command: string;
    status: string;
    cwd: string;
    startedAt: string;
    endedAt?: string;
    exitCode: number | null;
  }>;
  task?: {
    id: string;
    command: string;
    status: string;
    output: string;
    exitCode: number | null;
  };
}

// ─── TaskManagerTool Implementation ───────────────────────────────────────────

export class TaskManagerTool extends Tool<TaskManagerInput, TaskManagerData> {
  readonly name = 'task_manager';
  readonly glyph = TOOL_GLYPHS.read; // Uses the read glyph '✱'
  readonly description =
    'Manage background shell tasks. List all active/recent tasks, read task logs, send stdin input, or terminate tasks.';
  readonly schema = TaskManagerSchema;
  override readonly isDangerous = false;

  async execute(params: TaskManagerInput, _context: ToolContext): Promise<ToolExecutionResult<TaskManagerData>> {
    switch (params.action) {
      case 'list': {
        const allTasks = taskManager.list();
        const runningCount = allTasks.filter((t) => t.status === 'running').length;
        const totalCount = allTasks.length;

        const summaryBadge = `listing tasks (${runningCount}/${totalCount} running)`;

        if (allTasks.length === 0) {
          const message = 'No background tasks found.';
          return this.success(
            message,
            { action: 'list', summary: summaryBadge, tasks: [] },
            summaryBadge
          );
        }

        const lines: string[] = [`Background tasks (${runningCount} running, ${totalCount} total):\n`];
        for (const task of allTasks) {
          const statusIcon = task.status === 'running' ? '●' : task.status === 'completed' ? '✓' : '✗';
          const exitInfo = task.exitCode !== null ? ` [exit: ${task.exitCode}]` : '';
          lines.push(`${statusIcon} ${task.id} [${task.status}] ${exitInfo} $ ${task.command}`);
        }

        return this.success(
          lines.join('\n'),
          {
            action: 'list',
            summary: summaryBadge,
            tasks: allTasks.map((t) => ({
              id: t.id,
              command: t.command,
              status: t.status,
              cwd: t.cwd,
              startedAt: t.startedAt,
              endedAt: t.endedAt,
              exitCode: t.exitCode,
            })),
          },
          summaryBadge
        );
      }

      case 'read': {
        try {
          const taskData = taskManager.read(params.taskId);
          const maxLines = params.lines ?? 50;
          const allOutputLines = taskData.output.split(/\r?\n/);
          const recentLines = allOutputLines.slice(-maxLines);

          const summaryBadge = `read task ${params.taskId}`;
          const message = [
            `Task ${taskData.id} [${taskData.status}] ($ ${taskData.command})`,
            `Exit code: ${taskData.exitCode ?? 'running'}`,
            `\n--- Output (last ${recentLines.length} lines) ---`,
            recentLines.join('\n') || '(No output produced yet)',
          ].join('\n');

          return this.success(
            message,
            {
              action: 'read',
              summary: summaryBadge,
              task: {
                id: taskData.id,
                command: taskData.command,
                status: taskData.status,
                output: recentLines.join('\n'),
                exitCode: taskData.exitCode,
              },
            },
            summaryBadge
          );
        } catch (err: any) {
          return this.error(err.message || `Failed to read task ${params.taskId}`);
        }
      }

      case 'send_input': {
        try {
          const res = await taskManager.sendInput(params.taskId, params.input);
          const escapedInput = JSON.stringify(params.input);
          const summaryBadge = `Send ${escapedInput} to task ${params.taskId}`;

          return this.success(
            res.message,
            {
              action: 'send_input',
              summary: summaryBadge,
            },
            summaryBadge
          );
        } catch (err: any) {
          return this.error(err.message || `Failed to send input to task ${params.taskId}`);
        }
      }

      case 'kill': {
        try {
          const res = await taskManager.kill(params.taskId);
          const summaryBadge = `killed task ${params.taskId}`;

          return this.success(
            res.message,
            {
              action: 'kill',
              summary: summaryBadge,
            },
            summaryBadge
          );
        } catch (err: any) {
          return this.error(err.message || `Failed to terminate task ${params.taskId}`);
        }
      }
    }
  }

  override formatBadge(params: TaskManagerInput, result?: ToolExecutionResult<TaskManagerData>): string {
    if (result?.badge) return result.badge;
    switch (params.action) {
      case 'list':
        return 'listing tasks';
      case 'read':
        return `read task ${params.taskId}`;
      case 'send_input':
        return `Send ${JSON.stringify(params.input)} to task ${params.taskId}`;
      case 'kill':
        return `killed task ${params.taskId}`;
    }
  }
}
