/**
 * @steward/cli - Application Runtime Composition Root
 *
 * Single source of truth for constructing and wiring the AI runtime,
 * credentials resolver, and verifying structural compatibility with ModelPort.
 */

import { createAI, type AI } from '@steward/ai';
import type { ModelPort } from '@steward/agent';
import { getToken } from '@steward/oauth';

export interface RuntimeOptions {
  fetch?: typeof fetch;
}

export interface StewardRuntime {
  ai: AI;
  modelPort: ModelPort;
}

/**
 * Creates the central AI client and wires credential resolution from
 * OAuth token store and environment variables.
 */
export function createRuntime(options: RuntimeOptions = {}): StewardRuntime {
  const ai = createAI({
    fetch: options.fetch,
    getApiKey: async (provider) => {
      return (await getToken(provider)) ?? undefined;
    },
  });

  // Compile-time structural verification that AI implements ModelPort
  const modelPort: ModelPort = ai;

  return {
    ai,
    modelPort,
  };
}
