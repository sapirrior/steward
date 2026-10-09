import type { ReasoningEffort } from '@steward/ai';

export const DEFAULT_PROVIDER = 'google';
export const DEFAULT_MODEL = 'gemini-flash-latest';
export const DEFAULT_THEME = 'default';
export const DEFAULT_REASONING_EFFORT: ReasoningEffort = 'medium';

export const DEFAULT_COLLAPSED_BASH_LINES = 15;
export const DEFAULT_BASH_TIMEOUT_MS = 60_000;
export const DEFAULT_BASH_FOREGROUND_BUDGET_MS = 8_000; // 8 seconds foreground budget
export const DEFAULT_WEB_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_STEPS = 50;

export const DEFAULT_TOOLS_STATE = {
  read: true,
  glob: true,
  grep: true,
  webfetch: true,
  websearch: true,
  bash: true,
} as const;

export const DEFAULT_SETTINGS = {
  version: 1,
  model: DEFAULT_MODEL,
  theme: DEFAULT_THEME,
  reasoningEffort: DEFAULT_REASONING_EFFORT,
  tools: DEFAULT_TOOLS_STATE,
  bash: {
    autoApprove: false,
    timeoutMs: DEFAULT_BASH_TIMEOUT_MS,
  },
} as const;
