export type ChatMode = 'normal' | 'chat' | 'review' | 'build';

export interface ChatModeMeta {
  name: ChatMode;
  label: string;
  description: string;
  themeColorKey: string; // UITheme key: 'text' | 'info' | 'warning' | 'success'
}

export const CHAT_MODES: Record<ChatMode, ChatModeMeta> = {
  normal: {
    name: 'normal',
    label: 'Normal',
    description: 'All tools with file and bash permission prompts',
    themeColorKey: 'text',
  },
  chat: {
    name: 'chat',
    label: 'Chat',
    description: 'Conversation only — no tool access',
    themeColorKey: 'info',
  },
  review: {
    name: 'review',
    label: 'Review',
    description: 'Read-only tools only — cannot modify files or run commands',
    themeColorKey: 'warning',
  },
  build: {
    name: 'build',
    label: 'Build',
    description: 'All tools, file mutations auto-approved, bash still prompts',
    themeColorKey: 'success',
  },
};

const MODE_ORDER: ChatMode[] = ['normal', 'chat', 'review', 'build'];

let activeMode: ChatMode = 'normal';

export function getActiveMode(): ChatMode {
  return activeMode;
}
export function setActiveMode(name: string): void {
  if (name in CHAT_MODES) activeMode = name as ChatMode;
}
export function cycleMode(): ChatMode {
  const idx = MODE_ORDER.indexOf(activeMode);
  activeMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length]!;
  return activeMode;
}
export function listModes(): ChatModeMeta[] {
  return Object.values(CHAT_MODES);
}
export function findMode(query: string): ChatModeMeta | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return listModes().find(
    (m) => m.name === q || m.label.toLowerCase() === q || m.label.toLowerCase().startsWith(q),
  );
}

/** Returns true if the given tool name is allowed in review mode */
export const REVIEW_ALLOWED_TOOLS = new Set([
  'read_file',
  'glob',
  'grep',
  'list_dir',
  'web_fetch',
  'web_search',
  'todo_read',
  'skill_list',
  'skill_read',
  'task_list',
  'task_read',
  'sleep',
]);

/**
 * Throws a descriptive error if toolName is not allowed in the current mode.
 * Call this at the very top of a tool's execute() function.
 */
export function assertToolAllowed(toolName: string): void {
  const mode = activeMode;
  if (mode === 'normal' || mode === 'build') return; // all tools allowed

  if (mode === 'chat') {
    throw new Error(
      `Tool "${toolName}" is not available in Chat mode. Chat mode is for conversation only — no tool access. Switch to Normal or Build mode with /mode or Ctrl+B.`,
    );
  }

  if (mode === 'review' && !REVIEW_ALLOWED_TOOLS.has(toolName)) {
    throw new Error(
      `Tool "${toolName}" is not available in Review mode. Review mode only allows read-only operations. Switch to Normal or Build mode with /mode or Ctrl+B.`,
    );
  }
}
