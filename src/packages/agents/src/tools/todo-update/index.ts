import { z } from 'zod';
import {
  updateTodoItem,
  type PersistedTodoList,
  type TodoItem,
  type TodoItemStatus,
} from '@steward/services/todos/index.js';
import type { ToolDefinition } from '../types.js';

const todoUpdateParamsSchema = z.object({
  id: z.string().min(1, 'id is required').describe('ID of the existing todo item to update'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled', 'blocked'])
    .optional()
    .describe('New status for the todo item'),
  description: z.string().min(1).optional().describe('Updated description for the todo item'),
});

export type TodoUpdateParams = z.infer<typeof todoUpdateParamsSchema>;

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

export const todoUpdateTool: ToolDefinition<typeof todoUpdateParamsSchema, PersistedTodoList> = {
  name: 'todo_update',
  displayName: 'TodoUpdate',
  icon: '✓',
  access: 'write',
  description:
    'Updates a single todo item status or description in the current session. Cannot create new items or update multiple items at once.',
  parameters: todoUpdateParamsSchema,

  summarizeArgs(args) {
    if (args.status) return args.status;
    if (args.id) return args.id;
    return '';
  },

  async execute(args, context) {
    if (!context.sessionId) {
      throw new Error('TodoUpdate requires an active session ID in ToolContext');
    }
    return updateTodoItem(context.sessionId, args.id, {
      status: args.status,
      description: args.description,
    });
  },

  summarize(args, result) {
    // result may arrive as a JSON string from session replay — parse it first
    let resolved = result;
    if (typeof resolved === 'string') {
      try {
        resolved = JSON.parse(resolved);
      } catch {
        /* leave as-is; handled below */
      }
    }
    if (!resolved || !(resolved as PersistedTodoList).todos) {
      return `Todo ${args.id} updated`;
    }
    const result2 = resolved as PersistedTodoList;
    const total = result2.todos.length;
    const completed = result2.todos.filter((t) => t.status === 'completed').length;
    const updatedItem = result2.todos.find((t) => t.id === args.id);
    const statusText = updatedItem?.status ?? args.status ?? 'updated';
    const header = `Todo ${args.id} ${statusText} · ${completed}/${total} done`;
    const details = formatTodoListSummary(result2.todos);
    return { headline: header, detail: { kind: 'pre-styled' as const, text: details } };
  },
};
