/**
 * @steward/ai - createAI() — Provider registry + inference dispatch
 *
 * The core runtime object. All failures surface as stream error events —
 * ai.stream() never throws, result() never rejects (§4.4 contract).
 */

import {
  resolveApiKey,
  type AuthEnvGetter,
  type AuthOptions,
  type AuthScheme,
  type AuthSource,
  type ResolvedAuth,
} from './auth.js';
import { AssistantMessageStream } from './event-stream.js';
import { AIError } from './errors.js';
import { builtinProviders } from './provider/index.js';
import { streamText, stepCountIs } from 'ai';
import { getNamespaceConfig } from './transformer/config.js';
import { normalizeMessages } from './transformer/messages.js';
import { normalizeOptions } from './transformer/options.js';
import { normalizeTools } from './transformer/tools.js';
import { pumpSdkStream } from './transformer/stream.js';
import type {
  InferenceRequest,
  InferenceResult,
  InferenceStream,
  Model,
  ModelSelection,
  ProviderId,
  ProtocolId,
  ReasoningEffort,
} from './types.js';

// ─── Provider interface ───────────────────────────────────────────────────────

export interface Provider {
  readonly id: ProviderId;
  readonly name: string;
  readonly baseUrl?: string;
  readonly envVars?: readonly string[];
  readonly authScheme?: AuthScheme;
  readonly keyless?: boolean;
  readonly defaultModelId?: string;
  /**
   * SDK namespace key used in providerMetadata / providerOptions lookups.
   */
  readonly namespace?: string;
  /**
   * LanguageModel factory hook.
   */
  languageModel(
    modelId: string,
    auth: ResolvedAuth,
    fetchFn?: typeof fetch,
  ): import('ai').LanguageModel;
}

// ─── Provider & Auth Status ───────────────────────────────────────────────────

export interface ProviderAuthStatus {
  provider: ProviderId;
  configured: boolean;
  source?: AuthSource;
  envVars: readonly string[];
}

// Suppress AI SDK warnings and direct console logging in TUI environment
if (typeof globalThis !== 'undefined') {
  (globalThis as any).AI_SDK_LOG_WARNINGS = false;
}

export interface RefreshCatalogOptions {
  force?: boolean;
  signal?: AbortSignal;
}

// ─── AI interface ─────────────────────────────────────────────────────────────

export interface AI {
  providers(): readonly Provider[];
  provider(id: ProviderId): Provider | undefined;
  registerProvider(p: Provider): void;
  unregisterProvider(id: ProviderId): void;

  models(filter?: ProviderId): readonly Model[];
  model(providerId: ProviderId, modelId: string): Model | undefined;
  registerModel(model: Model): void;
  refreshCatalog(opts?: RefreshCatalogOptions): Promise<{ updated: number }>;

  availableModels(filter?: ProviderId): Promise<readonly Model[]>;

  isConfigured(providerId: ProviderId): Promise<boolean>;
  authStatus(providerId: ProviderId): Promise<ProviderAuthStatus>;
  resolveModel(request?: {
    provider?: ProviderId;
    modelId?: string;
    effort?: ReasoningEffort;
  }): Promise<ModelSelection>;

  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<InferenceResult>;
}

export interface CreateAIOptions {
  apiKeys?: Record<string, string | undefined>;
  getApiKey?: (providerId: string) => string | Promise<string | undefined> | undefined;
  env?: AuthEnvGetter;
  providers?: readonly Provider[];
  models?: readonly Model[];
  fetch?: typeof globalThis.fetch;
}

export function createAI(opts: CreateAIOptions = {}): AI {
  const providersMap = new Map<ProviderId, Provider>();
  const modelsMap = new Map<string, Model>();
  const fetchFn = opts.fetch ?? globalThis.fetch;

  // Seed providers
  const initialProviders = opts.providers ?? builtinProviders();
  for (const p of initialProviders) {
    providersMap.set(p.id, p);
  }

  // Override/add user-provided models
  for (const m of opts.models ?? []) {
    modelsMap.set(`${m.provider}/${m.id}`, m);
  }

  const authOptions: AuthOptions = {
    apiKeys: opts.apiKeys,
    getApiKey: opts.getApiKey,
    env: opts.env,
  };

  function resolveAuth(provider: Provider, requestApiKey?: string): Promise<ResolvedAuth> {
    return resolveApiKey(provider, authOptions, requestApiKey);
  }

  const ai: AI = {
    providers(): readonly Provider[] {
      return [...providersMap.values()];
    },

    provider(id: ProviderId): Provider | undefined {
      return providersMap.get(id);
    },

    registerProvider(p: Provider): void {
      providersMap.set(p.id, p);
    },

    unregisterProvider(id: ProviderId): void {
      providersMap.delete(id);
    },

    models(filter?: ProviderId): readonly Model[] {
      const all = [...modelsMap.values()];
      if (filter) return all.filter((m) => m.provider === filter);
      return all;
    },

    model(providerId: ProviderId, modelId: string): Model | undefined {
      return modelsMap.get(`${providerId}/${modelId}`);
    },

    registerModel(model: Model): void {
      modelsMap.set(`${model.provider}/${model.id}`, model);
    },

    async refreshCatalog(_refreshOpts?: RefreshCatalogOptions): Promise<{ updated: number }> {
      return { updated: 0 };
    },

    async isConfigured(providerId: ProviderId): Promise<boolean> {
      const p = providersMap.get(providerId);
      if (!p) return false;
      try {
        await resolveAuth(p);
        return true;
      } catch {
        return false;
      }
    },

    async authStatus(providerId: ProviderId): Promise<ProviderAuthStatus> {
      const p = providersMap.get(providerId);
      if (!p) {
        return { provider: providerId, configured: false, envVars: [] };
      }
      const envVars = p.envVars ?? [];
      try {
        const auth = await resolveAuth(p);
        return {
          provider: providerId,
          configured: true,
          source: auth.source,
          envVars,
        };
      } catch {
        return { provider: providerId, configured: false, envVars };
      }
    },

    async availableModels(filter?: ProviderId): Promise<readonly Model[]> {
      const available: Model[] = [];
      for (const p of providersMap.values()) {
        try {
          await resolveAuth(p);
          const providerModels = ai.models(p.id);
          if (providerModels.length > 0) {
            available.push(...providerModels);
          } else if (p.defaultModelId) {
            available.push(syntheticModel(p.id, p.defaultModelId, p));
          }
        } catch {
          // Provider unconfigured — skip
        }
      }
      if (filter) return available.filter((m) => m.provider === filter);
      return available;
    },

    async resolveModel(request?: {
      provider?: ProviderId;
      modelId?: string;
      effort?: ReasoningEffort;
    }): Promise<ModelSelection> {
      const providerId = request?.provider ?? 'anthropic';
      const modelId = request?.modelId ?? 'claude-sonnet-4-5';
      const effort: ReasoningEffort = request?.effort ?? 'medium';
      return {
        provider: providerId,
        modelId,
        effort,
      };
    },

    stream(request: InferenceRequest): InferenceStream {
      const providerId = request.model.provider;
      const modelId =
        'modelId' in request.model ? request.model.modelId : (request.model as Model).id;
      const p = providersMap.get(providerId);

      let model: Model | undefined;
      if ('protocol' in request.model && (request.model as Model).protocol) {
        model = request.model as Model;
      } else if (p) {
        const found = modelsMap.get(`${providerId}/${modelId}`);
        model = found ?? syntheticModel(providerId, modelId, p);
      }

      const stream = new AssistantMessageStream({ model });

      (async () => {
        try {
          if (!p) {
            throw new AIError(`Unknown provider: ${providerId}`, {
              code: 'invalid-request',
              provider: providerId,
            });
          }

          if (!model) {
            const found = modelsMap.get(`${providerId}/${modelId}`);
            model = found ?? syntheticModel(providerId, modelId, p);
          }

          const auth = await resolveAuth(p, request.apiKey);

          // ── SDK dispatch ────────────────────────────────────────────────────
          const namespace = p.namespace ?? p.id;
          const config = getNamespaceConfig(namespace);
          const { instructions, messages } = normalizeMessages(request.messages);
          const opts = normalizeOptions(request, model, config);
          const tools = normalizeTools(request.tools);
          const sdkModel = p.languageModel(model.id, auth, fetchFn);
          const sdkStream = streamText({
            model: sdkModel,
            instructions,
            messages,
            tools,
            stopWhen: stepCountIs(1),
            maxOutputTokens: opts.maxOutputTokens,
            temperature: opts.temperature,
            reasoning: opts.reasoning,
            providerOptions: opts.providerOptions as any,
            headers: opts.headers,
            abortSignal: request.abortSignal,
            maxRetries: 0,
            onError: () => {}, // Suppress direct console.error logging — handled via pumpSdkStream
          });
          await pumpSdkStream(sdkStream, stream, model, request);
        } catch (err) {
          stream.push({
            type: 'error',
            error:
              err instanceof AIError
                ? err
                : new AIError(err instanceof Error ? err.message : String(err), {
                    code: 'provider',
                  }),
          });
        }
      })();

      return stream;
    },

    async complete(request: InferenceRequest): Promise<InferenceResult> {
      return this.stream(request).result();
    },
  };

  return ai;
}

function inferProtocol(providerId: ProviderId): ProtocolId {
  if (providerId === 'anthropic') return 'anthropic-messages';
  if (providerId === 'google') return 'google-generative-ai';
  if (providerId === 'openai') return 'openai-responses';
  return 'openai-completions';
}

function syntheticModel(providerId: ProviderId, modelId: string, provider: Provider): Model {
  const protocol = inferProtocol(providerId);

  return {
    id: modelId,
    name: modelId,
    provider: providerId,
    protocol,
    baseUrl: provider.baseUrl ?? 'https://api.openai.com/v1',
    reasoning: false,
    input: ['text'],
    contextWindow: 128000,
    maxOutputTokens: 4096,
    temperature: true,
  };
}
