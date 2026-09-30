/**
 * @steward/ai - createAI() — Provider registry + inference dispatch
 *
 * The core runtime object. All failures surface as stream error events —
 * ai.stream() never throws, result() never rejects (§4.4 contract).
 */

import type { AuthContext, AuthInteraction, AuthStatus, Credential, CredentialStore, ProviderAuth, ResolvedAuth } from './auth/types.js';
import { AssistantMessageStream } from './event-stream.js';
import { AIError } from './errors.js';
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

// ─── createAI options ─────────────────────────────────────────────────────────

export interface CreateAIOptions {
  credentials: CredentialStore;
  authContext?: AuthContext;
  providers?: readonly Provider[];
  /** Injectable fetch — defaults to globalThis.fetch. Used for tests and proxies. */
  fetch?: typeof globalThis.fetch;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export function createAI(opts: CreateAIOptions): AI {
  const registry = new Map<ProviderId, Provider>();
  const fetchFn = opts.fetch ?? globalThis.fetch;

  for (const p of opts.providers ?? []) {
    registry.set(p.id, p);
  }

  function resolveAuth(provider: Provider): Promise<ResolvedAuth> {
    return resolveProviderAuth(provider, opts.credentials, opts.authContext);
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
        await opts.credentials.modify(providerId, async () => cred);
        return cred;
      }
      // api-key: prompt the user for the key via interaction
      const key = await interaction.prompt({ type: 'secret', message: `Enter API key for ${provider.name}:` });
      const cred: Credential = { type: 'api-key', key };
      await opts.credentials.modify(providerId, async () => cred);
      return cred;
    },

    async logout(providerId: ProviderId): Promise<void> {
      await opts.credentials.delete(providerId);
    },

    stream(request: InferenceRequest): InferenceStream {
      const stream = new AssistantMessageStream();

      // Setup runs async — errors are pushed as terminal error events
      (async () => {
        try {
          const { provider: providerId, modelId } = request.model;

          const provider = registry.get(providerId);
          if (!provider) {
            throw new AIError(`Unknown provider: ${providerId}`, { code: 'invalid-request', provider: providerId });
          }

          // Find model — allow unknown model ids (new models before catalog update)
          let model = provider.models().find((m) => m.id === modelId);
          if (!model) {
            // Synthetic fallback model using provider defaults
            model = syntheticModel(providerId, modelId, provider);
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

async function resolveProviderAuth(
  provider: Provider,
  store: CredentialStore,
  context: AuthContext | undefined,
): Promise<ResolvedAuth> {
  // 1. Try stored credential
  const stored = await store.read(provider.id);
  if (stored) {
    if (stored.type === 'api-key' && provider.auth.apiKey) {
      const resolved = provider.auth.apiKey.resolve(stored);
      if (resolved) return resolved;
    }
    if (stored.type === 'oauth' && provider.auth.oauth) {
      return provider.auth.oauth.toAuth(stored as import('./auth/types.js').OAuthCredential);
    }
  }

  // 2. Try ambient env vars (via injected AuthContext)
  if (context && provider.auth.apiKey) {
    for (const envVar of provider.auth.apiKey.envVars) {
      const val = context.env(envVar);
      if (val) {
        return { apiKey: val, source: `env:${envVar}` };
      }
    }
  }

  // 3. Keyless fallback — try resolve with no credential (e.g. local servers, faux provider)
  if (provider.auth.apiKey) {
    const keyless = provider.auth.apiKey.resolve({ type: 'api-key', key: '' });
    if (keyless) return keyless;
  }

  throw new AIError(
    `No credentials configured for provider ${provider.id}`,
    { code: 'auth', provider: provider.id },
  );
}

/** Synthetic fallback Model for unknown model ids (new models before catalog). */
function syntheticModel(providerId: ProviderId, modelId: string, provider: Provider): Model {
  // Use the first known model's protocol as a hint, default to openai-completions
  const hint = provider.models()[0];
  return {
    id: modelId,
    name: modelId,
    provider: providerId,
    protocol: hint?.protocol ?? 'openai-completions',
    baseUrl: hint?.baseUrl ?? provider.baseUrl ?? '',
    reasoning: false,
    maxOutputTokens: 4096,
  };
}
