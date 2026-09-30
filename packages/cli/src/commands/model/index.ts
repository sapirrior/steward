import { ALL_PROVIDER_NAMES, getEnvConfig, saveSettings } from '@steward/services/config/index.js';
import {
  fetchAvailableModels,
  createAuthManager,
  type DiscoveredModel,
  type ProviderId,
} from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

function getDiscoveryAuthContext() {
  const config = getEnvConfig();
  const authManager = createAuthManager();
  return {
    getApiKey: async (provider: ProviderId) => {
      const resolved = await authManager.resolve(provider).catch(() => undefined);
      return resolved?.token && resolved.token !== 'none' ? resolved.token : undefined;
    },
    getCustomEndpoint: () => config.custom,
    getOllamaEndpoint: () => config.ollamaBaseUrl,
  };
}

/**
 * /model slash command: opens interactive model picker dock when invoked with no args,
 * or switches model directly and persists preference to ~/.steward/settings.json.
 */
export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'View or switch the active model with interactive model picker',
  usage: '/model [model_id | provider model_id]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const current = context.session.getModel();
    const authCtx = getDiscoveryAuthContext();

    // 1. If no args provided, trigger interactive ModelPicker dock
    if (args.length === 0) {
      const discovery = await fetchAvailableModels(authCtx);
      return {
        handled: true,
        data: {
          showModelPicker: true,
          models: discovery.models,
          current,
        },
      };
    }

    // 2. Switching model: support both "/model <model_id>" and "/model <provider> <model_id>"
    let targetProvider: string | undefined;
    let targetModelId: string;

    const validProviders: readonly string[] = ALL_PROVIDER_NAMES;

    if (args.length === 1) {
      targetModelId = args[0].trim();
    } else {
      const first = args[0].trim().toLowerCase();
      const normFirst = first === 'copilot' ? 'github-copilot' : first;
      if (validProviders.includes(normFirst as any)) {
        targetProvider = normFirst;
        targetModelId = args.slice(1).join(' ').trim();
      } else {
        targetModelId = args.join(' ').trim();
      }
    }

    // 3. Validate against discovered models
    const discovery = await fetchAvailableModels(authCtx);
    const matches = discovery.models.filter((m: DiscoveredModel) => {
      const idMatch =
        m.modelId.toLowerCase() === targetModelId.toLowerCase() ||
        m.modelId.toLowerCase().includes(targetModelId.toLowerCase());
      if (targetProvider) {
        return m.provider === targetProvider && idMatch;
      }
      return idMatch;
    });

    if (matches.length === 0) {
      return {
        handled: true,
        message: `Model "${targetModelId}" was not found among available models.\nType "/model" to open the interactive model picker.`,
      };
    }

    // Pick exact match if available, otherwise first match
    const selected =
      matches.find(
        (m: DiscoveredModel) => m.modelId.toLowerCase() === targetModelId.toLowerCase(),
      ) ?? matches[0];

    // 4. Update session
    const updatedSelection = context.session.setModel({
      provider: selected.provider,
      modelId: selected.modelId,
      effort: current.effort ?? 'medium',
    });

    // 5. Save to ~/.steward/settings.json
    saveSettings({
      model: {
        provider: updatedSelection.provider,
        modelId: updatedSelection.modelId,
        effort: updatedSelection.effort,
      },
    });

    return {
      handled: true,
      message: `Active model switched to ${selected.provider}/${selected.modelId} and saved to ~/.steward/settings.json.`,
      data: { selected: updatedSelection },
    };
  },
};
