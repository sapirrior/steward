import type { ReasoningEffort } from '../agent/types.js';

export interface ToolSettings {
  read: boolean;
  glob: boolean;
  grep: boolean;
  webfetch: boolean;
  websearch: boolean;
  bash: boolean;
}

export interface BashSettings {
  autoApprove: boolean;
  timeoutMs: number;
}

export interface StewardSettings {
  version: 1;
  provider: string;
  model: string;
  theme: string;
  reasoningEffort: ReasoningEffort;
  tools: ToolSettings;
  bash: BashSettings;
}
