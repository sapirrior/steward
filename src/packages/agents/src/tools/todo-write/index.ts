import { z } from 'zod';
import {
  writeTodoList,
  type PersistedTodoList,
  type TodoItem,
  type TodoItemStatus,
} from '@steward/services/todos/index.js';
import type { ToolDefinition } from '../types.js';

const todoItemSchema = z.object({
  id: z.string().min(1, 'id is required').describe('Unique identifier for the todo item'),
  description: z
    .string()
    .min(1, 'description is required')
    .describe('Clear description of the task'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled', 'blocked'])
    .describe('Current status of the todo item'),
});

const todoWriteParamsSchema = z.object({
  todos: z
    .array(todoItemSchema)
    .min(2, 'Todo list must contain at least 2 items')
    .max(10, 'Todo list must contain at most 10 items')
    .describe('Complete list of 2 to 10 todo items establishing the execution plan'),
});

export type TodoWriteParams = z.infer<typeof todoWriteParamsSchema>;

import { c, bold, strikethrough } from '@steward/tui/theme/style.js';

function formatTodoCheckbox(status: TodoItemStatus): string {
  switch (status) {
    case 'completed':
      return '[x]';
    case 'in_progress':
      return '[▲]';
    case 'cancelled':
      return '[✖]';
    case 'blocked':
      return '[⚠]';
    case 'pending':
    default:
      return '[ ]';
  }
}

function formatTodoListSummary(todos: TodoItem[], maxItems = 10): string {
  const visible = todos.slice(0, maxItems);
  const hiddenCount = todos.length - visible.length;
  const lines = visible.map((t, i) => {
    const raw = `${i + 1}. ${formatTodoCheckbox(t.status)} ${t.description}`;
    if (t.status === 'completed') {
      return strikethrough(c.muted(raw));
    }
    if (t.status === 'in_progress') {
      return bold(c.text(raw));
    }
    if (t.status === 'cancelled') {
      return strikethrough(c.muted(raw));
    }
    if (t.status === 'blocked') {
      return c.warning(raw);
    }
    return c.text(raw);
  });
  if (hiddenCount > 0) {
    lines.push(c.muted(`… and ${hiddenCount} more`));
  }
  return lines.join('\n');
}

export const todoWriteTool: ToolDefinition<typeof todoWriteParamsSchema, PersistedTodoList> = {
  name: 'todo_write',
  displayName: 'TodoWrite',
  icon: '📝',
  access: 'write',
  description:
    'Initializes or replaces the current session todo list with 2 to 10 items. Use this to establish or replace the multi-step execution plan for the session.',
  parameters: todoWriteParamsSchema,

  summarizeArgs(args) {
    if (!args.todos || args.todos.length === 0) return '';
    const count = args.todos.length;
    return `${count} items`;
  },

  async execute(args, context) {
    if (!context.sessionId) {
      throw new Error('TodoWrite requires an active session ID in ToolContext');
    }
    return writeTodoList(context.sessionId, args.todos);
  },

  summarize(args, result) {
    const list = result?.todos ?? args.todos;
    const total = list.length;
    const header = `Added ${total} todos`;
    const details = formatTodoListSummary(list);
    return { headline: header, detail: { kind: 'pre-styled' as const, text: details } };
  },
};
