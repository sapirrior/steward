import type { ProviderId } from '@steward/ai';

export type ProviderName = ProviderId;

export const ALL_PROVIDER_NAMES: readonly ProviderName[] = [
  'gemini',
  'anthropic',
  'openai',
  'deepseek',
  'openrouter',
  'github-copilot',
  'groq',
  'xai',
  'mistral',
  'ollama',
  'custom',
] as const;

/**
 * Normalized configuration for all supported model providers
 * loaded from global system environment variables.
 */
export interface EnvConfig {
  geminiApiKey?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  deepseekApiKey?: string;
  openrouterApiKey?: string;
  copilotGithubToken?: string;
  groqApiKey?: string;
  xaiApiKey?: string;
  mistralApiKey?: string;
  ollamaBaseUrl?: string;
  custom: {
    apiKey?: string;
    modelName?: string;
    baseURL?: string;
  };
}

/**
 * Reads and returns provider credentials directly from global environment variables.
 */
export function getEnvConfig(): EnvConfig {
  const geminiApiKey =
    process.env['GEMINI_API_KEY']?.trim() ||
    process.env['GOOGLE_GENERATIVE_AI_API_KEY']?.trim() ||
    undefined;

  const anthropicApiKey = process.env['ANTHROPIC_API_KEY']?.trim() || undefined;

  const openaiApiKey = process.env['OPENAI_API_KEY']?.trim() || undefined;

  const deepseekApiKey = process.env['DEEPSEEK_API_KEY']?.trim() || undefined;

  const openrouterApiKey = process.env['OPENROUTER_API_KEY']?.trim() || undefined;

  const copilotGithubToken = process.env['COPILOT_GITHUB_TOKEN']?.trim() || undefined;

  const groqApiKey = process.env['GROQ_API_KEY']?.trim() || undefined;

  const xaiApiKey = process.env['XAI_API_KEY']?.trim() || undefined;

  const mistralApiKey =
    process.env['MISTRAL_API_KEY']?.trim() || process.env['CODESTRAL_API_KEY']?.trim() || undefined;

  const ollamaBaseUrl = process.env['OLLAMA_BASE_URL']?.trim() || undefined;

  const customApiKey = process.env['CUSTOM_API_KEY']?.trim() || undefined;
  const customApiModelName = process.env['CUSTOM_API_MODEL_NAME']?.trim() || undefined;
  const customApiUrl = process.env['CUSTOM_API_URL']?.trim() || undefined;

  return {
    geminiApiKey,
    anthropicApiKey,
    openaiApiKey,
    deepseekApiKey,
    openrouterApiKey,
    copilotGithubToken,
    groqApiKey,
    xaiApiKey,
    mistralApiKey,
    ollamaBaseUrl,
    custom: {
      apiKey: customApiKey,
      modelName: customApiModelName,
      baseURL: customApiUrl,
    },
  };
}

/**
 * Checks if the necessary credentials/configuration exist for a given provider.
 */
export function hasProviderConfig(provider: ProviderName, config = getEnvConfig()): boolean {
  switch (provider) {
    case 'gemini':
      return Boolean(config.geminiApiKey);
    case 'anthropic':
      return Boolean(config.anthropicApiKey);
    case 'openai':
      return Boolean(config.openaiApiKey);
    case 'deepseek':
      return Boolean(config.deepseekApiKey);
    case 'openrouter':
      return Boolean(config.openrouterApiKey);
    case 'github-copilot':
      return Boolean(config.copilotGithubToken);
    case 'groq':
      return Boolean(config.groqApiKey);
    case 'xai':
      return Boolean(config.xaiApiKey);
    case 'mistral':
      return Boolean(config.mistralApiKey);
    case 'ollama':
      return Boolean(config.ollamaBaseUrl);
    case 'custom':
      return Boolean(config.custom.baseURL && config.custom.modelName);
  }
}

/**
 * Returns a list of all providers that have valid credentials configured in the environment.
 */
export function getAvailableProviders(config = getEnvConfig()): ProviderName[] {
  const providers: ProviderName[] = [];

  for (const name of ALL_PROVIDER_NAMES) {
    if (hasProviderConfig(name, config)) {
      providers.push(name);
    }
  }

  return providers;
}
