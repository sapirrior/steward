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
import {
  filterModels,
  parseModelsDevModel,
  inferProtocolForModel,
  type ModelFilter,
  type ModelsDevApiResponse,
} from './models/catalog.js';
import { resolveModelSelection, type ModelSelectionRequest } from './models/selection.js';
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
} from './types.js';

// ─── Provider interface ───────────────────────────────────────────────────────

export type ProtocolStream = (
  model: Model,
  request: InferenceRequest,
  auth: ResolvedAuth,
  fetchFn: typeof fetch,
  stream: AssistantMessageStream,
) => Promise<void>;

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
   * Set by built-in providers; undefined for legacy/faux providers.
   */
  readonly namespace?: string;
  /**
   * Additive SDK factory hook (plan.md Decision D2 — strangler pattern).
   * When present, client.ts dispatches through the SDK pipeline.
   * When absent, falls back to the legacy `streams` map.
   */
  languageModel?(modelId: string, auth: ResolvedAuth, fetchFn?: typeof fetch): import('ai').LanguageModel;
  streams: Partial<Record<ProtocolId, ProtocolStream>>;
  prepare?(
    model: Model,
    request: InferenceRequest,
    auth: ResolvedAuth,
  ): { headers?: Record<string, string>; baseUrl?: string };
}


// ─── Provider & Auth Status ───────────────────────────────────────────────────

export interface ProviderAuthStatus {
  provider: ProviderId;
  configured: boolean;
  source?: AuthSource;
  envVars: readonly string[];
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

  models(filter?: ModelFilter | ProviderId): readonly Model[];
  model(providerId: ProviderId, modelId: string): Model | undefined;
  registerModel(model: Model): void;
  refreshCatalog(opts?: RefreshCatalogOptions): Promise<{ updated: number }>;

  /** Returns models only for configured providers. */
  availableModels(filter?: ModelFilter | ProviderId): Promise<readonly Model[]>;

  isConfigured(providerId: ProviderId): Promise<boolean>;
  authStatus(providerId: ProviderId): Promise<ProviderAuthStatus>;
  resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection>;

  /**
   * Start a streaming inference. NEVER throws synchronously.
   * Unknown provider, missing credentials, setup errors -> single terminal error event.
   */
  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<InferenceResult>;
}

export interface CreateAIOptions {
  apiKeys?: Record<string, string | undefined>;
  getApiKey?: (providerId: string) => string | Promise<string | undefined> | undefined;
  env?: AuthEnvGetter;
  providers?: readonly Provider[];
  models?: readonly Model[];
  /** Injectable fetch — defaults to globalThis.fetch. Used for tests and proxies. */
  fetch?: typeof globalThis.fetch;
  /** Custom endpoint for dynamic models.dev metadata (default: 'https://models.dev/api.json') */
  modelsDevUrl?: string;
  /** Disable dynamic models.dev fetching */
  disableModelsDev?: boolean;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function createAI(opts: CreateAIOptions = {}): AI {
  const providersMap = new Map<ProviderId, Provider>();
  const modelsMap = new Map<string, Model>();
  const fetchFn = opts.fetch ?? globalThis.fetch;
  const modelsDevUrl = opts.modelsDevUrl ?? 'https://models.dev/api.json';
  const disableModelsDev = opts.disableModelsDev ?? false;

  let catalogEtag: string | undefined;
  let catalogFetchedAt = 0;
  const CATALOG_TTL_MS = 60 * 60 * 1000; // 1 hour

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

  function normalizeFilter(filter?: ModelFilter | ProviderId): ModelFilter | undefined {
    if (typeof filter === 'string') return { provider: filter };
    return filter;
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

    models(filter?: ModelFilter | ProviderId): readonly Model[] {
      const all = [...modelsMap.values()];
      return filterModels(all, normalizeFilter(filter));
    },

    model(providerId: ProviderId, modelId: string): Model | undefined {
      return modelsMap.get(`${providerId}/${modelId}`);
    },

    registerModel(model: Model): void {
      modelsMap.set(`${model.provider}/${model.id}`, model);
    },

    async refreshCatalog(refreshOpts?: RefreshCatalogOptions): Promise<{ updated: number }> {
      if (disableModelsDev) {
        return { updated: 0 };
      }

      const now = Date.now();
      if (!refreshOpts?.force && catalogFetchedAt && now - catalogFetchedAt < CATALOG_TTL_MS) {
        return { updated: 0 };
      }

      const headers: Record<string, string> = { Accept: 'application/json' };
      if (catalogEtag) headers['If-None-Match'] = catalogEtag;

      try {
        const res = await fetchFn(modelsDevUrl, {
          method: 'GET',
          headers,
          signal: refreshOpts?.signal,
        });

        if (res.status === 304) {
          catalogFetchedAt = now;
          return { updated: 0 };
        }

        if (!res.ok) {
          return { updated: 0 };
        }

        const etag = res.headers.get('etag') ?? undefined;
        if (etag) catalogEtag = etag;
        catalogFetchedAt = now;

        const data = (await res.json()) as ModelsDevApiResponse;
        let count = 0;

        for (const [providerKey, providerData] of Object.entries(data)) {
          if (!providerData.models) continue;
          const providerId = providerKey as ProviderId;

          for (const rawModel of Object.values(providerData.models)) {
            const parsed = parseModelsDevModel(providerId, rawModel, {
              baseUrl: providerData.api,
              api: providerData.api,
            });
            if (parsed) {
              modelsMap.set(`${providerId}/${parsed.id}`, parsed);
              count++;
            }
          }
        }
        return { updated: count };
      } catch {
        return { updated: 0 };
      }
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

    async availableModels(filter?: ModelFilter | ProviderId): Promise<readonly Model[]> {
      const available: Model[] = [];
      for (const p of providersMap.values()) {
        if (await ai.isConfigured(p.id)) {
          const providerModels = ai.models(p.id);
          if (providerModels.length > 0) {
            available.push(...providerModels);
          } else if (p.defaultModelId) {
            available.push(syntheticModel(p.id, p.defaultModelId, p));
          }
        }
      }
      return filterModels(available, normalizeFilter(filter));
    },

    async resolveModel(request?: ModelSelectionRequest): Promise<ModelSelection> {
      return resolveModelSelection(request, {
        isConfigured: (id) => ai.isConfigured(id),
      });
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

          // ── SDK dispatch (plan.md Decision D2 — strangler pattern) ──────────
          if (p.languageModel) {
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
            });
            await pumpSdkStream(sdkStream, stream, model, request);
            return;
          }

          // ── Legacy protocol dispatch ─────────────────────────────────────────
          const protocolFn = p.streams[model.protocol];
          if (!protocolFn) {
            throw new AIError(
              `Provider ${providerId} does not implement protocol ${model.protocol}`,
              { code: 'invalid-request', provider: providerId },
            );
          }
          const prepared = p.prepare?.(model, request, auth);
          const effectiveAuth: ResolvedAuth = {
            ...auth,
            headers: { ...auth.headers, ...prepared?.headers },
            baseUrl: prepared?.baseUrl ?? auth.baseUrl,
          };
          await protocolFn(model, request, effectiveAuth, fetchFn, stream);
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Synthetic fallback Model for unknown model ids. */
function syntheticModel(providerId: ProviderId, modelId: string, provider: Provider): Model {
  const inferred = inferProtocolForModel(providerId, modelId);
  const streamKey = Object.keys(provider.streams)[0] as ProtocolId | undefined;
  const protocol = provider.streams[inferred] ? inferred : (streamKey ?? 'openai-completions');

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
