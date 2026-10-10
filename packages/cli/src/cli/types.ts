import type { ModelRef } from '@steward/models';
import type { ReasoningEffort } from '../agent/types.js';
import type { ToolSettings, BashSettings } from '../settings/settingsTypes.js';

export type ToolName = 'read' | 'glob' | 'grep' | 'webfetch' | 'websearch' | 'bash';

export const VALID_TOOL_NAMES: readonly ToolName[] = [
  'read',
  'glob',
  'grep',
  'webfetch',
  'websearch',
  'bash',
] as const;

export const VALID_THEMES = ['default', 'github'] as const;
export type CliTheme = (typeof VALID_THEMES)[number];

export const VALID_REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'max',
] as const;

/**
 * Raw flags received directly from Commander.js option parsing.
 */
export interface RawCliFlags {
  prompt?: string;
  model?: string;
  effort?: string;
  tool?: string[];
  enableTool?: string[];
  disableTool?: string[];
  autoApprove?: boolean;
  theme?: string;
  login?: string;
  logout?: string | boolean;
  authStatus?: boolean;
}

/**
 * Resolved, normalized runtime configuration with layered precedence:
 * CLI Flags > Environment Variables > ~/.steward/settings.json > Canonical Defaults
 */
export interface ResolvedCliConfig {
  modelRef: ModelRef;
  reasoningEffort: ReasoningEffort;
  tools: ToolSettings;
  bash: BashSettings;
  theme: CliTheme;
  prompt?: string;
}
