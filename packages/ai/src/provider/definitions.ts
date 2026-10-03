/**
 * @steward/ai — Provider Definitions
 *
 * Declarative table: one row per provider.
 * No branching logic. All provider-specific behavior lives either here
 * (identity / auth / construction) or in transformer/config.ts (stream behavior).
 *
 * Adding a new provider = add one row here + optionally one entry in transformer/config.ts.
 * Zero changes needed elsewhere.
 */

import {
  createAnthropic,
  type AnthropicProvider,
} from '@ai-sdk/anthropic';
import {
  createOpenAI,
  type OpenAIProvider,
} from '@ai-sdk/openai';
import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProvider,
} from '@ai-sdk/google';
import {
  createMistral,
  type MistralProvider,
} from '@ai-sdk/mistral';
import {
  createXai,
  type XaiProvider,
} from '@ai-sdk/xai';
import {
  createDeepSeek,
  type DeepSeekProvider,
} from '@ai-sdk/deepseek';
import {
  createGroq,
  type GroqProvider,
} from '@ai-sdk/groq';
import {
  createOpenAICompatible,
  type OpenAICompatibleProvider,
} from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { ProviderId, ProtocolId } from '../types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FetchFn = typeof fetch;

export interface ResolvedAuth {
  apiKey?: string;
  headers?: Record<string, string>;
}

/**
 * A single provider row in the definitions table.
 * `factory` is the only place that knows which AI SDK package to call.
 */
export interface ProviderDefinition {
  /** Steward canonical provider id */
  id: ProviderId;
  /** Human-readable name */
  name: string;
  /** SDK providerMetadata namespace key (used in transformer/config.ts) */
  namespace: string;
  /** models.dev provider key (for catalog ingestion) */
  modelsDevId?: string;
  /** Default base URL — overrides SDK default when set */
  baseUrl?: string;
  /** Env vars checked for API key (in priority order) */
  envVars: readonly string[];
  /** Whether this provider works without an API key (e.g. Ollama local) */
  keyless?: boolean;
  /**
   * Legacy protocol label kept for session `isSameModel` continuity.
   * DO NOT change — existing persisted sessions compare meta.protocol.
   */
  protocolLabel: ProtocolId;
  /** Default model ID used when no model is specified */
  defaultModelId?: string;
  /**
   * Builds the AI SDK LanguageModel for this provider.
   * Called per request — factories are cheap, no caching needed.
   */
  factory(modelId: string, auth: ResolvedAuth, fetchFn?: FetchFn): LanguageModel;
}

// ─── Definitions table ────────────────────────────────────────────────────────

export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    namespace: 'anthropic',
    modelsDevId: 'anthropic',
    envVars: ['ANTHROPIC_API_KEY'],
    protocolLabel: 'anthropic-messages',
    defaultModelId: 'claude-sonnet-4-5',
    factory(modelId, auth, fetchFn) {
      const p: AnthropicProvider = createAnthropic({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    namespace: 'openai',
    modelsDevId: 'openai',
    envVars: ['OPENAI_API_KEY'],
    protocolLabel: 'openai-responses',
    defaultModelId: 'gpt-4o',
    factory(modelId, auth, fetchFn) {
      const p: OpenAIProvider = createOpenAI({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p.responses(modelId);
    },
  },
  {
    id: 'google',
    name: 'Google Gemini',
    namespace: 'google',
    modelsDevId: 'google',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    protocolLabel: 'google-generative-ai',
    defaultModelId: 'gemini-2.5-flash',
    factory(modelId, auth, fetchFn) {
      const p: GoogleGenerativeAIProvider = createGoogleGenerativeAI({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    namespace: 'mistral',
    modelsDevId: 'mistral',
    envVars: ['MISTRAL_API_KEY'],
    protocolLabel: 'openai-completions',
    defaultModelId: 'mistral-large-latest',
    factory(modelId, auth, fetchFn) {
      const p: MistralProvider = createMistral({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    namespace: 'xai',
    modelsDevId: 'xai',
    envVars: ['XAI_API_KEY'],
    // xai@5 uses Responses API only (no chat() method exists — confirmed Phase 0)
    protocolLabel: 'openai-responses',
    defaultModelId: 'grok-3',
    factory(modelId, auth, fetchFn) {
      const p: XaiProvider = createXai({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    namespace: 'deepseek',
    modelsDevId: 'deepseek',
    envVars: ['DEEPSEEK_API_KEY'],
    protocolLabel: 'openai-completions',
    defaultModelId: 'deepseek-chat',
    factory(modelId, auth, fetchFn) {
      const p: DeepSeekProvider = createDeepSeek({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'groq',
    name: 'Groq',
    namespace: 'groq',
    modelsDevId: 'groq',
    envVars: ['GROQ_API_KEY'],
    protocolLabel: 'openai-completions',
    defaultModelId: 'llama-3.3-70b-versatile',
    factory(modelId, auth, fetchFn) {
      const p: GroqProvider = createGroq({
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    namespace: 'openrouter',
    modelsDevId: 'openrouter',
    envVars: ['OPENROUTER_API_KEY'],
    // OpenRouter follows openai-completions (code, not CHANGELOG — confirmed Decision D12)
    protocolLabel: 'openai-completions',
    defaultModelId: 'anthropic/claude-sonnet-4-5',
    factory(modelId, auth, fetchFn) {
      const p: OpenAICompatibleProvider = createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: auth.apiKey,
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    namespace: 'ollama',
    envVars: [],
    keyless: true,
    protocolLabel: 'openai-completions',
    defaultModelId: 'llama3.2',
    factory(modelId, auth, fetchFn) {
      const p: OpenAICompatibleProvider = createOpenAICompatible({
        name: 'ollama',
        baseURL: 'http://localhost:11434/v1',
        // keyless — no apiKey needed
        headers: auth.headers,
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    namespace: 'github-copilot',
    envVars: ['GITHUB_TOKEN', 'COPILOT_API_KEY'],
    protocolLabel: 'openai-completions',
    defaultModelId: 'gpt-4o',
    factory(modelId, auth, fetchFn) {
      // Re-expressed as OpenAI-compatible per Decision D12 (keep, not remove)
      const p: OpenAICompatibleProvider = createOpenAICompatible({
        name: 'github-copilot',
        baseURL: 'https://api.individual.githubcopilot.com/v1',
        apiKey: auth.apiKey,
        headers: {
          'Copilot-Integration-Id': 'vscode-chat',
          'Editor-Version': 'vscode/1.99.0',
          ...auth.headers,
        },
        fetch: fetchFn,
      });
      return p(modelId);
    },
  },
] as const;

/** Look up a definition by Steward provider id (or alias) */
export function getProviderDefinition(id: string): ProviderDefinition | undefined {
  const normalized = id === 'xai' || id === 'gemini' ? (id === 'xai' ? 'grok' : 'google') : id;
  return PROVIDER_DEFINITIONS.find((d) => d.id === normalized);
}
