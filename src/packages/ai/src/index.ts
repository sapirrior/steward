/**
 * @steward/ai - Public API Entry Point
 *
 * Zero-dependency, pure Web Standards AI engine and model orchestrator.
 */

// ─── Domain Types & Contracts ────────────────────────────────────────────────
export type {
  ProviderId,
  BuiltinProviderId,
  ProtocolId,
  ReasoningEffort,
  JsonPrimitive,
  JsonValue,
  JsonObject,
  JsonSchema,
  TextContent,
  ThinkingContent,
  ToolCallContent,
  ToolResultContent,
  AssistantContent,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  Message,
  ToolSpec,
  TokenUsage,
  TokenCost,
  FinishReason,
  AssistantMeta,
  Model,
  OpenAICompletionsCompat,
  OpenAIResponsesCompat,
  AnthropicMessagesCompat,
  GoogleGenerativeAICompat,
  ProtocolCompat,
  ModelSelection,
  ModelDescriptor,
  InferenceRequest,
  TextDeltaEvent,
  ReasoningDeltaEvent,
  ToolCallStartEvent,
  ToolCallDeltaEvent,
  ToolCallEndEvent,
  DoneEvent,
  ErrorEvent,
  InferenceEvent,
  InferenceResult,
  InferenceStream,
} from './types.js';

// ─── Auth Types & Resolver ───────────────────────────────────────────────────
export type {
  ApiKeyCredential,
  OAuthCredential,
  Credential,
  CredentialInfo,
  CredentialStore,
  AuthContext,
  ResolvedAuth,
  ApiKeyAuth,
  OAuthAuth,
  ProviderAuth,
  AuthPrompt,
  AuthEvent,
  AuthInteraction,
  AuthStatus,
} from './auth/types.js';

export { InMemoryCredentialStore } from './auth/memory-store.js';
export { resolveAuth, type ResolveAuthOptions } from './auth/resolve.js';
export { envApiKeyAuth } from './auth/api-key.js';
export { generatePKCE } from './auth/pkce.js';
export { pollOAuthDeviceCodeFlow, type DeviceCodePollOptions } from './auth/device-code.js';
export { loginGoogle, refreshGoogle, toGoogleAuth } from './auth/oauth/google.js';

// ─── Core Runtime ─────────────────────────────────────────────────────────────
export {
  createAI,
  type AI,
  type CreateAIOptions,
  type Provider,
  type ProtocolStream,
} from './client.js';

export { AssistantMessageStream } from './event-stream.js';
export { AIError, type AIErrorCode, type AIErrorOptions } from './errors.js';

// ─── Models & Catalog ─────────────────────────────────────────────────────────
export {
  fetchModelsDevCatalog,
  parseModelsDevItem,
  inferProtocolForModel,
  clearModelsDevCache,
  type ModelsDevModel,
  type ModelsDevResponse,
} from './models/catalog.js';

export {
  getSupportedEfforts,
  clampThinkingEffort,
  calculateAnthropicBudgetTokens,
  REASONING_EFFORTS,
} from './models/thinking.js';

export {
  resolveModelSelection,
  inferProviderFromModelId,
  PROVIDER_SELECTION_PRIORITY,
  DEFAULT_PROVIDER_MODELS,
  CANONICAL_DEFAULT_EFFORT,
  type ModelSelectionRequest,
  type ModelResolutionContext,
} from './models/selection.js';

// ─── Message Transformations ──────────────────────────────────────────────────
export {
  transformMessages,
  defaultNormalizeToolCallId,
} from './transform/messages.js';

// ─── Protocols ────────────────────────────────────────────────────────────────
export {
  anthropicMessagesProtocol,
  openAICompletionsProtocol,
  openAIResponsesProtocol,
  googleGenerativeAIProtocol,
} from './protocols/index.js';

// ─── Providers ────────────────────────────────────────────────────────────────
export {
  anthropicProvider,
  openAIProvider,
  googleProvider,
  githubCopilotProvider,
  openRouterProvider,
  openAICompatibleProvider,
  builtinProviders,
  type OpenAICompatibleProviderOptions,
} from './providers/index.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { decodeSSE } from './util/sse.js';
export { parseJson, parseStreamingJson } from './util/json.js';
export { sanitizeSurrogates } from './util/sanitize.js';
export { readErrorBody } from './util/error-body.js';
export { isContextOverflow } from './util/overflow.js';
export { withRetry, type RetryOptions, type HttpError } from './util/retry.js';
export { calculateCost } from './util/cost.js';

// ─── Legacy Shims (Preserved for Monorepo Migration in Phase 11) ───────────────
export {
  createAIEngine,
  streamInference,
  DefaultAIEngine,
  type AIEngine,
  type AIEngineOptions,
} from './inference.js';
export { fetchAvailableModels, type DiscoveredModel, type ModelDiscoveryResult, type ProviderDiscoveryStatus } from './models/discovery.js';
export { createAuthManager, DefaultAuthManager, type AuthManager } from './auth/manager.js';
