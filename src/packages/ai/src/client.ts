/**
 * @steward/ai - createAI() — Provider registry + inference dispatch
 *
 * The core runtime object. All failures surface as stream error events —
 * ai.stream() never throws, result() never rejects (§4.4 contract).
 */

import type { AuthContext, AuthInteraction, AuthStatus, Credential, CredentialStore, ProviderAuth, ResolvedAuth } from './auth/types.js';
import { InMemoryCredentialStore } from './auth/memory-store.js';
import { resolveAuth } from './auth/resolve.js';
import { AssistantMessageStream } from './event-stream.js';
import { AIError } from './errors.js';
import { inferProtocolForModel } from './models/catalog.js';
import type {
  BuiltinProviderId,
  InferenceRequest,
  InferenceStream,
  Model,
  ProviderId,
  ProtocolId,
} from './types.js';

// ─── Provider interface ───────────────────────────────────────────────────────

/**
 * Wire protocol stream function — raw fetch, drives the provided stream directly.
 * Returns a Promise that resolves once done/error has been pushed.
 * Must not throw — all failures go through stream.push({ type: 'error', ... }).
 */
export type ProtocolStream = (
  model: Model,
  request: InferenceRequest,
  auth: ResolvedAuth,
  fetchFn: typeof fetch,
  stream: import('./event-stream.js').AssistantMessageStream,
) => Promise<void>;

/**
 * A provider definition. Each built-in provider is a small object (~60 lines)
 * that declares its models, auth, and protocol dispatch.
 */
export interface Provider {
  readonly id: ProviderId;
  readonly name: string;
  readonly baseUrl?: string;
  readonly auth: ProviderAuth;
  /** Sync catalog of known models (may be empty before first refreshModels). */
  models(): readonly Model[];
  /** Optional: the default model id for this provider. */
  defaultModelId?: string;
  /**
   * Fetch fresh model list from the provider API.
   * Returns the updated list. Auth is already resolved.
   */
  fetchModels?(auth: ResolvedAuth, fetchFn: typeof fetch, signal?: AbortSignal): Promise<readonly Model[]>;
  /**
   * Optional provider policy for credential-specific model availability
   * (e.g. GitHub Copilot subscription-specific enabled models).
   */
  filterModels?(models: readonly Model[], credential?: Credential): readonly Model[];
  /**
   * Map of protocol id → stream function.
   * A provider may support multiple protocols (e.g. Copilot: 3 protocols).
   */
  streams: Partial<Record<ProtocolId, ProtocolStream>>;
  /**
   * Optional: compute extra headers or baseUrl overrides per-request
   * (e.g. Copilot's X-Initiator header inferred from last message role).
   */
  prepare?(model: Model, request: InferenceRequest, auth: ResolvedAuth): { headers?: Record<string, string>; baseUrl?: string };
}

// ─── AI interface ─────────────────────────────────────────────────────────────

export interface AI {
  providers(): readonly Provider[];
  registerProvider(p: Provider): void;
  unregisterProvider(id: ProviderId): void;

  models(providerId?: ProviderId): readonly Model[];
  model(providerId: ProviderId, modelId: string): Model | undefined;
  /** Returns models only for configured providers, applying credential filters. */
  availableModels(providerId?: ProviderId): Promise<readonly Model[]>;

  authStatus(providerId: ProviderId): Promise<AuthStatus>;
  login(providerId: ProviderId, method: 'api-key' | 'oauth', interaction: AuthInteraction): Promise<Credential>;
  logout(providerId: ProviderId): Promise<void>;

  /**
   * Start a streaming inference. NEVER throws synchronously.
   * Unknown provider, missing credentials, setup errors → single terminal error event.
   */
  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<import('./types.js').InferenceResult>;
}

export interface CreateAIOptions {
  credentials?: CredentialStore;
  credentialStore?: CredentialStore;
  authContext?: AuthContext;
  providers?: readonly Provider[];
  /** Injectable fetch — defaults to globalThis.fetch. Used for tests and proxies. */
  fetch?: typeof globalThis.fetch;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function createAI(opts: CreateAIOptions = {}): AI {
  const store = opts.credentials ?? opts.credentialStore ?? new InMemoryCredentialStore();
  const registry = new Map<ProviderId, Provider>();
  const fetchFn = opts.fetch ?? globalThis.fetch;

  for (const p of opts.providers ?? []) {
    registry.set(p.id, p);
  }

  function resolveAuth(provider: Provider): Promise<ResolvedAuth> {
    return resolveProviderAuth(provider, store, opts.authContext);
  }

  return {
    providers(): readonly Provider[] {
      return [...registry.values()];
    },

    registerProvider(p: Provider): void {
      registry.set(p.id, p);
    },

    unregisterProvider(id: ProviderId): void {
      registry.delete(id);
    },

    models(providerId?: ProviderId): readonly Model[] {
      if (providerId) {
        return registry.get(providerId)?.models() ?? [];
      }
      return [...registry.values()].flatMap((p) => {
        try { return p.models() as Model[]; } catch { return []; }
      });
    },

    model(providerId: ProviderId, modelId: string): Model | undefined {
      return registry.get(providerId)?.models().find((m) => m.id === modelId);
    },

    async availableModels(providerId?: ProviderId): Promise<readonly Model[]> {
      const targetProviders = providerId
        ? [registry.get(providerId)].filter(Boolean)
        : [...registry.values()];

      const available: Model[] = [];
      for (const provider of targetProviders) {
        if (!provider) continue;
        try {
          const auth = await resolveAuth(provider);
          let providerModels = provider.models();
          if (providerModels.length === 0 && provider.fetchModels) {
            providerModels = await provider.fetchModels(auth, fetchFn);
          }
          if (provider.filterModels) {
            const stored = await store.read(provider.id);
            providerModels = provider.filterModels(providerModels, stored);
          }
          available.push(...providerModels);
        } catch {
          // Provider unconfigured or expired without auto-refresh -> skip
        }
      }
      return available;
    },

    async authStatus(providerId: ProviderId): Promise<AuthStatus> {
      const provider = registry.get(providerId);
      if (!provider) {
        return { provider: providerId, configured: false };
      }
      try {
        const auth = await resolveAuth(provider);
        return {
          provider: providerId,
          configured: true,
          source: auth.source as AuthStatus['source'],
        };
      } catch {
        return { provider: providerId, configured: false };
      }
    },

    async login(providerId: ProviderId, method: 'api-key' | 'oauth', interaction: AuthInteraction): Promise<Credential> {
      const provider = registry.get(providerId);
      if (!provider) throw new AIError(`Unknown provider: ${providerId}`, { code: 'invalid-request' });
      if (method === 'oauth') {
        if (!provider.auth.oauth) throw new AIError(`Provider ${providerId} does not support OAuth`, { code: 'auth' });
        const cred = await provider.auth.oauth.login(interaction);
        await store.modify(providerId, async () => cred);
        return cred;
      }
      // api-key: prompt the user for the key via interaction
      const key = await interaction.prompt({ type: 'secret', message: `Enter API key for ${provider.name}:` });
      const cred: Credential = { type: 'api-key', key };
      await store.modify(providerId, async () => cred);
      return cred;
    },

    async logout(providerId: ProviderId): Promise<void> {
      await store.delete(providerId);
    },

    stream(request: InferenceRequest): InferenceStream {
      const stream = new AssistantMessageStream();

      // Setup runs async — errors are pushed as terminal error events
      (async () => {
        try {
          const providerId = request.model.provider;
          const modelId = 'modelId' in request.model ? request.model.modelId : request.model.id;

          const provider = registry.get(providerId);
          if (!provider) {
            throw new AIError(`Unknown provider: ${providerId}`, { code: 'invalid-request', provider: providerId });
          }

          // If a full Model with protocol was passed, use it directly
          let model: Model;
          if ('protocol' in request.model && request.model.protocol) {
            model = request.model as Model;
          } else {
            // Find model — allow unknown model ids (new models before catalog update)
            const found = provider.models().find((m) => m.id === modelId);
            model = found ?? syntheticModel(providerId, modelId, provider);
          }

          const protocolFn = provider.streams[model.protocol];
          if (!protocolFn) {
            throw new AIError(
              `Provider ${providerId} does not implement protocol ${model.protocol}`,
              { code: 'invalid-request', provider: providerId },
            );
          }

          const auth = await resolveAuth(provider);

          // Merge provider.prepare() overrides into auth
          const prepared = provider.prepare?.(model, request, auth);
          const effectiveAuth: ResolvedAuth = {
            ...auth,
            headers: { ...auth.headers, ...prepared?.headers },
            baseUrl: prepared?.baseUrl ?? auth.baseUrl,
          };

          // Delegate to the protocol — it drives the stream via push()
          await protocolFn(model, request, effectiveAuth, fetchFn, stream);
        } catch (err) {
          stream.push({
            type: 'error',
            error: err instanceof AIError
              ? err
              : new AIError(err instanceof Error ? err.message : String(err), { code: 'provider' }),
          });
        }
      })();

      return stream;
    },

    async complete(request: InferenceRequest) {
      return this.stream(request).result();
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveProviderAuth(
  provider: Provider,
  store: CredentialStore,
  context: AuthContext | undefined,
): Promise<ResolvedAuth> {
  return resolveAuth(provider, store, context);
}

/** Synthetic fallback Model for unknown model ids (new models before catalog). */
function syntheticModel(providerId: ProviderId, modelId: string, provider: Provider): Model {
  const hint = provider.models()[0];
  const inferred = inferProtocolForModel(providerId, modelId);
  const streamKey = Object.keys(provider.streams)[0] as ProtocolId | undefined;
  const protocol = hint?.protocol ?? (provider.streams[inferred] ? inferred : (streamKey ?? 'openai-completions'));

  return {
    id: modelId,
    name: modelId,
    provider: providerId,
    protocol,
    baseUrl: hint?.baseUrl ?? provider.baseUrl ?? '',
    reasoning: false,
    maxOutputTokens: 4096,
  };
}
