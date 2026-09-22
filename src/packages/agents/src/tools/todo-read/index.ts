import { z } from 'zod';
import {
  readTodoList,
  type PersistedTodoList,
  type TodoItem,
  type TodoItemStatus,
} from '@steward/services/todos/index.js';
import type { ToolDefinition } from '../types.js';

const todoReadParamsSchema = z.object({});

export type TodoReadParams = z.infer<typeof todoReadParamsSchema>;

export interface TodoReadResult {
  hasTodos: boolean;
  todos: PersistedTodoList['todos'];
  updatedAt?: string;
  message?: string;
}

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
    if (t.status === 'completed') return strikethrough(c.muted(raw));
    if (t.status === 'in_progress') return bold(c.text(raw));
    if (t.status === 'cancelled') return strikethrough(c.muted(raw));
    if (t.status === 'blocked') return c.warning(raw);
    return c.text(raw);
  });
  if (hiddenCount > 0) {
    lines.push(c.muted(`… and ${hiddenCount} more`));
  }
  return lines.join('\n');
}

export const todoReadTool: ToolDefinition<typeof todoReadParamsSchema, TodoReadResult> = {
  name: 'todo_read',
  displayName: 'TodoRead',
  icon: '📋',
  access: 'read',
  description:
    'Reads the current session todo list without modifying it. Returns an empty result if no todos have been established yet.',
  parameters: todoReadParamsSchema,

  summarizeArgs() {
    return '';
  },

  async execute(_args, context) {
    if (!context.sessionId) {
      throw new Error('TodoRead requires an active session ID in ToolContext');
    }
    const list = await readTodoList(context.sessionId);
    if (!list) {
      return {
        hasTodos: false,
        todos: [],
        message: 'No todos currently established for this session.',
      };
    }
    return {
      hasTodos: true,
      todos: list.todos,
      updatedAt: list.updatedAt,
    };
  },

  summarize(_args, result) {
    // result may arrive as a JSON string from session replay — parse it first
    let resolved: TodoReadResult | null = result ?? null;
    if (typeof resolved === 'string') {
      try {
        resolved = JSON.parse(resolved as unknown as string);
      } catch {
        /* leave null; falls through to "No active todos" */
      }
    }
    // Accept both { hasTodos, todos } and bare { todos } shapes
    const todos: TodoItem[] | undefined =
      resolved && Array.isArray((resolved as any).todos) ? (resolved as any).todos : undefined;
    if (!todos || todos.length === 0) {
      return 'No active todos';
    }
    const total = todos.length;
    const completed = todos.filter((t) => t.status === 'completed').length;
    const active = todos.find((t) => t.status === 'in_progress');
    const header = active
      ? `Todos ${completed}/${total} done · ▶ ${active.description}`
      : `Todos ${completed}/${total} done`;
    const details = formatTodoListSummary(todos);
    return { headline: header, detail: { kind: 'pre-styled' as const, text: details } };
  },
};
