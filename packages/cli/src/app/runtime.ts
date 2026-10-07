import { type AI } from '@steward/ai';
import { createAI } from '@steward/ai';
import { getToken } from '@steward/oauth';

export interface RuntimeOptions {
  fetch?: typeof fetch;
}

export interface StewardRuntime {
  ai: AI;
  modelPort: AI;
}

export function createRuntime(options: RuntimeOptions = {}): StewardRuntime {
  const ai = createAI({
    fetch: options.fetch,
    getApiKey: async (provider) => {
      return (await getToken(provider)) ?? undefined;
    },
  });

  return {
    ai,
    modelPort: ai,
  };
}
