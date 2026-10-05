import type { ProviderId, ReasoningEffort } from '@steward/ai';
import { loadSettings, saveSettings, type SavedModelSettings } from './store.js';

export function normalizeReasoningEffort(val?: string | null): ReasoningEffort {
  if (!val) return 'medium';
  const lower = val.toLowerCase().trim();
  if (lower === 'none' || lower === 'off' || lower === '0') return 'none';
  if (lower === 'low' || lower === 'minimal' || lower === '1' || lower === '2' || lower === '3')
    return 'low';
  if (lower === 'xhigh' || lower === 'max' || lower === '6') return 'xhigh';
  if (lower === 'high' || lower === '5') return 'high';
  return 'medium';
}

/**
 * Returns the persisted model selection from settings.json if present.
 * Remaps legacy 'gemini' provider to 'google'.
 */
export function getSavedModel(): SavedModelSettings | undefined {
  const settings = loadSettings();
  if (
    settings.model &&
    typeof settings.model.provider === 'string' &&
    typeof settings.model.modelId === 'string'
  ) {
    const rawProvider = settings.model.provider;
    const provider = (rawProvider === 'gemini' ? 'google' : rawProvider) as ProviderId;
    return {
      provider,
      modelId: settings.model.modelId,
      effort: normalizeReasoningEffort(settings.model.effort),
    };
  }
  return undefined;
}

export function saveModel(model: SavedModelSettings): void {
  saveSettings({
    model: {
      provider: model.provider,
      modelId: model.modelId,
      effort: model.effort ?? 'medium',
    },
  });
}
