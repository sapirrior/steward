import { saveModel } from '../../settings/model.js';
import { type ProviderId, normalizeProviderId } from '@steward/ai';
import { createModels, type ModelMetadata } from '@steward/models';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

const modelsClient = createModels();

/**
 * /model slash command: opens interactive model picker dock when invoked with no args,
 * or switches model directly and persists preference to ~/.steward/settings.json.
 * Uses @steward/models to query the models.dev catalog for available models.
 */
export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'View or switch the active model with interactive model picker',
  usage: '/model [model_id | provider model_id]',

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const current = context.session.getModel();
    const ai = context.session.aiClient;

    // Refresh dynamic models client and ai catalog
    await Promise.allSettled([modelsClient.refresh(), ai.refreshCatalog()]);

    // Fetch available text-capable models from @steward/models
    let catalogModels: readonly ModelMetadata[] = [];
    try {
      catalogModels = await modelsClient.list({ textCapable: true });
    } catch {
      // Fallback handled below
    }

    // 1. If no args provided, trigger interactive ModelPicker dock
    if (args.length === 0) {
      let modelsToDisplay: readonly any[] = catalogModels;
      if (modelsToDisplay.length === 0) {
        const available = await ai.availableModels();
        modelsToDisplay = available.length > 0 ? available : ai.models();
      }

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
      targetModelId = args[0]!.trim();
    } else {
      const first = args[0]!.trim().toLowerCase();
      const normalizedFirst = normalizeProviderId(first);
      if (normalizedFirst && allProviders.includes(normalizedFirst)) {
        targetProvider = normalizedFirst;
        targetModelId = args.slice(1).join(' ').trim();
      } else {
        targetModelId = args.join(' ').trim();
      }
    }

    // 3. Search and match against @steward/models and local AI models
    const filterCandidates = (candidates: readonly any[]) =>
      candidates.filter((m) => {
        const id = m.id.toLowerCase();
        const name = m.name ? m.name.toLowerCase() : '';
        const query = targetModelId.toLowerCase();
        const idMatch =
          id === query || name === query || id.includes(query) || name.includes(query);
        if (targetProvider) {
          return m.provider.toLowerCase() === targetProvider.toLowerCase() && idMatch;
        }
        return idMatch;
      });

    const fallbackAiModels = ai.models();
    const candidateList = [...catalogModels, ...fallbackAiModels];
    const matches = filterCandidates(candidateList);

    if (matches.length === 0) {
      return {
        handled: true,
        message: `Model "${targetModelId}" was not found among available models.\nType "/model" to open the interactive model picker.`,
      };
    }

    // Prioritize: 1) exact match on configured provider, 2) exact ID match, 3) exact name match, 4) configured provider match, 5) first match
    const selected =
      matches.find(
        (m) =>
          (m.id.toLowerCase() === targetModelId.toLowerCase() ||
            (m.name && m.name.toLowerCase() === targetModelId.toLowerCase())) &&
          allProviders.includes(m.provider.toLowerCase()),
      ) ??
      matches.find((m) => m.id.toLowerCase() === targetModelId.toLowerCase()) ??
      matches.find((m) => m.name && m.name.toLowerCase() === targetModelId.toLowerCase()) ??
      matches.find((m) => allProviders.includes(m.provider.toLowerCase())) ??
      matches[0]!;

    const providerId = (normalizeProviderId(selected.provider) ?? selected.provider) as ProviderId;

    // 4. Update session
    const updatedSelection = context.session.setModel({
      provider: providerId,
      modelId: selected.id,
      effort: current.effort ?? 'medium',
    });

    // 5. Save to settings.json
    saveModel({
      provider: updatedSelection.provider,
      modelId: updatedSelection.modelId,
      effort: updatedSelection.effort,
    });

    return {
      handled: true,
      message: `Active model switched to ${selected.provider}/${selected.id} and saved to ~/.steward/settings.json.`,
      data: { selected: updatedSelection },
    };
  },
};
