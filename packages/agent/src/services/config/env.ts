import { createAI, type ProviderId } from '@steward/ai';

export type ProviderName = ProviderId;

/**
 * Checks if a given provider is configured with credentials in the environment.
 * Delegates directly to @steward/ai as the single source of truth.
 */
export async function hasProviderConfig(provider: ProviderId): Promise<boolean> {
  const ai = createAI();
  return ai.isConfigured(provider);
}

/**
 * Returns a list of all providers that have valid credentials configured in the environment.
 * Delegates directly to @steward/ai as the single source of truth.
 */
export async function getAvailableProviders(): Promise<ProviderId[]> {
  const ai = createAI();
  const statuses = await Promise.all(
    ai.providers().map(async (p) => ({
      id: p.id,
      configured: await ai.isConfigured(p.id),
    })),
  );
  return statuses.filter((s) => s.configured).map((s) => s.id);
}
