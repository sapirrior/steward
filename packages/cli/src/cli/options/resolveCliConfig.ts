import type { StewardSettings } from '../../settings/settingsTypes.js';
import { settingsStore } from '../../settings/settingsStore.js';
import type { RawCliFlags, ResolvedCliConfig } from '../types.js';
import { resolveModelOption } from './modelOption.js';
import { resolveEffortOption } from './effortOption.js';
import { resolveToolOptions } from './toolOption.js';
import { resolveThemeOption } from './themeOption.js';

export interface ResolveConfigOptions {
  flags: RawCliFlags;
  customSettings?: StewardSettings;
  env?: Record<string, string | undefined>;
}

/**
 * Resolves final CLI configuration with layered hierarchy:
 * CLI Flags > Environment Variables > ~/.steward/settings.json > Canonical Defaults
 */
export async function resolveCliConfig(options: ResolveConfigOptions): Promise<ResolvedCliConfig> {
  const { flags, env = process.env } = options;

  // 1. Load persistent settings (or use passed customSettings)
  const stored = options.customSettings ?? (await settingsStore.load());

  // 2. Resolve Model Ref
  // Precedence: flags.model > env.STEWARD_MODEL > stored.provider + stored.model
  const rawModel = flags.model || env.STEWARD_MODEL || undefined;
  const modelRef = resolveModelOption(
    rawModel,
    stored.provider || 'google',
    stored.model || 'gemini-flash-latest',
  );

  // 3. Resolve Reasoning Effort
  // Precedence: flags.effort > env.STEWARD_EFFORT > stored.reasoningEffort
  const rawEffort = flags.effort || env.STEWARD_EFFORT || stored.reasoningEffort;
  const reasoningEffort = resolveEffortOption(rawEffort, stored.reasoningEffort);

  // 4. Resolve Tools
  // Precedence: flags.tool / enableTool / disableTool > stored.tools
  const tools = resolveToolOptions(stored.tools, {
    tool: flags.tool,
    enableTool: flags.enableTool,
    disableTool: flags.disableTool,
  });

  // 5. Resolve Bash Settings
  // Precedence: flags.autoApprove > env.STEWARD_AUTO_APPROVE > stored.bash.autoApprove
  let autoApprove = stored.bash.autoApprove;
  if (typeof flags.autoApprove === 'boolean') {
    autoApprove = flags.autoApprove;
  } else if (env.STEWARD_AUTO_APPROVE !== undefined) {
    autoApprove = ['true', '1', 'yes'].includes(env.STEWARD_AUTO_APPROVE.toLowerCase());
  }

  const bash = {
    ...stored.bash,
    autoApprove,
  };

  // 6. Resolve Theme
  // Precedence: flags.theme > env.STEWARD_THEME > stored.theme
  const rawTheme = flags.theme || env.STEWARD_THEME || stored.theme;
  const theme = resolveThemeOption(rawTheme, 'default');

  // 7. Prompt
  const prompt = flags.prompt?.trim() || undefined;

  return {
    modelRef,
    reasoningEffort,
    tools,
    bash,
    theme,
    prompt,
  };
}
