export type ToolAccess = 'read' | 'write' | 'exec';

export type ChatMode = 'normal' | 'chat' | 'review' | 'build';

export interface ModeMeta {
  name: ChatMode;
  label: string;
  description: string;
  color: 'text' | 'info' | 'warning' | 'success';
  allows: readonly ToolAccess[];
  autoApproveFiles: boolean;
}

export const MODES: Record<ChatMode, ModeMeta> = {
  normal: {
    name: 'normal',
    label: 'Normal',
    description: 'All tools with file and bash permission prompts',
    color: 'text',
    allows: ['read', 'write', 'exec'] as const,
    autoApproveFiles: false,
  },
  chat: {
    name: 'chat',
    label: 'Chat',
    description: 'Conversation only — no tool access',
    color: 'info',
    allows: [] as const,
    autoApproveFiles: false,
  },
  review: {
    name: 'review',
    label: 'Review',
    description: 'Read-only tools only — cannot modify files or run commands',
    color: 'warning',
    allows: ['read'] as const,
    autoApproveFiles: false,
  },
  build: {
    name: 'build',
    label: 'Build',
    description: 'All tools, file mutations auto-approved, bash still prompts',
    color: 'success',
    allows: ['read', 'write', 'exec'] as const,
    autoApproveFiles: true,
  },
} as const;

export const MODES_POLICY = MODES;
export const CHAT_MODES = MODES;
export const MODE_NAMES: readonly ChatMode[] = ['normal', 'chat', 'review', 'build'] as const;

export const isAllowed = (m: ChatMode, a: ToolAccess): boolean => {
  const meta = MODES[m];
  if (!meta) return false;
  return meta.allows.includes(a);
};

export function isChatMode(value: unknown): value is ChatMode {
  return typeof value === 'string' && value in MODES;
}

const MODE_ORDER: ChatMode[] = ['normal', 'chat', 'review', 'build'];
let activeMode: ChatMode = 'normal';

export function getActiveMode(): ChatMode {
  return activeMode;
}

export function setActiveMode(name: string): void {
  if (name in MODES) {
    activeMode = name as ChatMode;
  }
}

export function cycleMode(): ChatMode {
  const idx = MODE_ORDER.indexOf(activeMode);
  activeMode = MODE_ORDER[(idx + 1) % MODE_ORDER.length]!;
  return activeMode;
}

export function listModes(): ModeMeta[] {
  return Object.values(MODES);
}

export function findMode(query: string): ModeMeta | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return listModes().find(
    (m) => m.name === q || m.label.toLowerCase() === q || m.label.toLowerCase().startsWith(q),
  );
}
