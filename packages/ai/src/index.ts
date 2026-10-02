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
  FinishReason,
  AssistantMeta,
  Model,
  ProtocolCompat,
  ModelSelection,
  InferenceRequest,
  InferenceEvent,
  InferenceResult,
  InferenceStream,
} from './types.js';

// ─── Auth ────────────────────────────────────────────────────────────────────
export {
  resolveApiKey,
  defaultEnvGetter,
  type AuthSource,
  type AuthScheme,
  type ResolvedAuth,
  type AuthEnvGetter,
  type AuthOptions,
} from './auth.js';

// ─── Core Runtime ─────────────────────────────────────────────────────────────
export {
  createAI,
  type AI,
  type CreateAIOptions,
  type Provider,
  type ProtocolStream,
  type ProviderAuthStatus,
} from './client.js';

export { AssistantMessageStream } from './event-stream.js';
export { AIError, type AIErrorCode, type AIErrorOptions } from './errors.js';

// ─── Models & Catalog ─────────────────────────────────────────────────────────
export {
  MODELS,
  PROVIDER_PRESETS,
  parseModelsDevModel,
  inferProtocolForModel,
  supportsReasoning,
  filterModels,
  type ProviderPreset,
  type ModelFilter,
  type ModelsDevApiResponse,
  type ModelsDevRawModel,
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
  openRouterProvider,
  grokProvider,
  mistralProvider,
  githubCopilotProvider,
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
