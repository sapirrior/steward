/**
 * @steward/ai - Static Catalog Generator
 *
 * Fetches https://models.dev/api.json and generates src/models/catalog.generated.ts.
 * Run via `bun run catalog:update`.
 */

import { parseModelsDevModel, type ModelsDevApiResponse } from '../src/models/models-dev.js';
import type { Model, ProviderId } from '../src/types.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ALLOWLIST_PRESETS = ['deepseek', 'groq', 'xai', 'mistral', 'cerebras', 'together'];

const LOCAL_PRESETS = [
  {
    id: 'ollama',
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    envVars: [],
    keyless: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    envVars: [],
    keyless: true,
  },
];

async function main() {
  console.log('Fetching models from https://models.dev/api.json...');
  const res = await fetch('https://models.dev/api.json');
  if (!res.ok) {
    throw new Error(`Failed to fetch models.dev (HTTP ${res.status})`);
  }

  const data = (await res.json()) as ModelsDevApiResponse;
  const models: Model[] = [];
  const presets: Array<{ id: string; name: string; baseUrl: string; envVars: string[]; keyless?: boolean }> = [...LOCAL_PRESETS];

  const targetProviders: ProviderId[] = ['anthropic', 'openai', 'google', 'openrouter'];

  for (const [providerKey, providerData] of Object.entries(data)) {
    const isBuiltin = targetProviders.includes(providerKey as ProviderId);
    const isPreset = ALLOWLIST_PRESETS.includes(providerKey);

    if (isPreset && providerData.api) {
      presets.push({
        id: providerKey,
        name: providerData.name || providerKey,
        baseUrl: providerData.api,
        envVars: providerData.env ?? [`${providerKey.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`],
      });
    }

    if (!isBuiltin && !isPreset) continue;
    if (!providerData.models) continue;

    const providerId = providerKey as ProviderId;
    for (const rawModel of Object.values(providerData.models)) {
      const parsed = parseModelsDevModel(providerId, rawModel, {
        baseUrl: providerData.api,
        api: providerData.api,
      });
      if (parsed) {
        models.push(parsed);
      }
    }
  }

  // Stable sort: by provider, then id
  models.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    return a.id.localeCompare(b.id);
  });

  presets.sort((a, b) => a.id.localeCompare(b.id));

  console.log(`Parsed ${models.length} active agentic models across ${targetProviders.length + ALLOWLIST_PRESETS.length} providers.`);

  const code = `/**
 * @steward/ai - Generated Static Model Catalog
 *
 * Generated automatically from https://models.dev/api.json.
 * DO NOT EDIT MANUALLY. Run \`bun run catalog:update\` to refresh.
 */

import type { Model } from '../types.js';

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  envVars: readonly string[];
  keyless?: boolean;
}

export const PROVIDER_PRESETS: readonly ProviderPreset[] = ${JSON.stringify(presets, null, 2)} as const;

export const MODELS: readonly Model[] = ${JSON.stringify(models, null, 2)};
`;

  const targetPath = resolve(import.meta.dir, '../src/models/catalog.generated.ts');
  writeFileSync(targetPath, code, 'utf-8');
  console.log(`Generated ${targetPath} (${(Buffer.byteLength(code) / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('Failed to generate catalog:', err);
  process.exit(1);
});
