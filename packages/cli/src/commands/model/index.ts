import { saveSettings } from '@steward/agent';
import { normalizeProviderId, type Model, type ProviderId } from '@steward/ai';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

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
    const ai = context.session.aiClient;

    // Refresh dynamic models.dev catalog if needed
    await ai.refreshCatalog().catch(() => {});

    // 1. If no args provided, trigger interactive ModelPicker dock
    if (args.length === 0) {
      const available = await ai.availableModels();
      const modelsToDisplay = available.length > 0 ? available : ai.models();
      return {
        handled: true,
        data: {
          showModelPicker: true,
          models: modelsToDisplay,
          current,
        },
      };
    }

    // 2. Switching model: support both "/model <model_id>" and "/model <provider> <model_id>"
    let targetProvider: string | undefined;
    let targetModelId: string;

    const allProviders = ai.providers().map((p) => p.id);

    if (args.length === 1) {
      targetModelId = args[0].trim();
    } else {
      const first = args[0].trim().toLowerCase();
      const normalizedFirst = normalizeProviderId(first);
      if (normalizedFirst && allProviders.includes(normalizedFirst)) {
        targetProvider = normalizedFirst;
        targetModelId = args.slice(1).join(' ').trim();
      } else {
        targetModelId = args.join(' ').trim();
      }
    }

    // 3. Validate against models
    const allModels = ai.models();
    const matches = allModels.filter((m: Model) => {
      const idMatch =
        m.id.toLowerCase() === targetModelId.toLowerCase() ||
        m.name.toLowerCase() === targetModelId.toLowerCase() ||
        m.id.toLowerCase().includes(targetModelId.toLowerCase());
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
        (m: Model) =>
          m.id.toLowerCase() === targetModelId.toLowerCase() ||
          m.name.toLowerCase() === targetModelId.toLowerCase(),
      ) ?? matches[0];

    // 4. Update session
    const updatedSelection = context.session.setModel({
      provider: selected.provider,
      modelId: selected.id,
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
      message: `Active model switched to ${selected.provider}/${selected.id} and saved to ~/.steward/settings.json.`,
      data: { selected: updatedSelection },
    };
  },
};
