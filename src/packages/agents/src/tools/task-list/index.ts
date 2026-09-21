import { z } from 'zod';
import type { ToolDefinition } from '../types.js';
import type { ShellTask } from '../../../../services/src/tasks/types.js';

export const taskListInputSchema = z.object({});

export type TaskListInput = z.infer<typeof taskListInputSchema>;

export interface TaskListOutput {
  tasks: ShellTask[];
  total: number;
}

export const taskListTool: ToolDefinition<typeof taskListInputSchema, TaskListOutput> = {
  name: 'task_list',
  displayName: 'Task List',
  access: 'read',
  description:
    'Lists all currently tracked background shell tasks along with their IDs, statuses, commands, and exit codes.',
  parameters: taskListInputSchema,
  confirmationPolicy: 'never',

  summarize: (_args, result) => {
    const count = result?.total ?? 0;
    return `Listed ${count} background task${count === 1 ? '' : 's'}`;
  },

  execute: async (_args, context) => {
    if (!context.shellTasks) {
      throw new Error('No shell tasks manager available in execution context.');
    }
    const tasks = context.shellTasks.list();
    return {
      tasks,
      total: tasks.length,
    };
  },
};
