/**
 * @steward/ai - Public API Entry Point
 *
 * Zero-dependency, pure Web Standards AI engine and model orchestrator.
 */

// Suppress AI SDK warnings and direct console logging in TUI environment
if (typeof globalThis !== 'undefined') {
  (globalThis as any).AI_SDK_LOG_WARNINGS = false;
}

import type { ProviderId } from './types.js';

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
  type ProviderAuthStatus,
} from './client.js';

export { AssistantMessageStream } from './event-stream.js';
export { AIError, type AIErrorCode, type AIErrorOptions } from './errors.js';

export function normalizeProviderId(provider?: string): ProviderId | undefined {
  if (!provider) return undefined;
  const lower = provider.trim().toLowerCase();
  if (lower === 'gemini') return 'google';
  if (lower === 'xai') return 'grok';
  return lower as ProviderId;
}

// ─── Providers ────────────────────────────────────────────────────────────────
export {
  anthropicProvider,
  openAIProvider,
  googleProvider,
  openRouterProvider,
  grokProvider,
  mistralProvider,
  githubCopilotProvider,
  deepseekProvider,
  ollamaProvider,
  groqProvider,
  customProvider,
  openAICompatibleProvider,
  builtinProviders,
  type OpenAICompatibleProviderOptions,
} from './provider/index.js';

// ─── Transformer ─────────────────────────────────────────────────────────────
export * from './transformer/index.js';

// ─── Utilities ────────────────────────────────────────────────────────────────
export { parseJson, parseStreamingJson } from './util/json.js';
export { sanitizeSurrogates } from './util/sanitize.js';
export { readErrorBody } from './util/error-body.js';
export { isContextOverflow } from './util/overflow.js';
export { withRetry, type RetryOptions, type HttpError } from './util/retry.js';
export { calculateCost } from './util/cost.js';
