/**
 * @steward/ai - Public API Entry Point
 */

// Domain types
export type {
  ProviderId,
  ReasoningEffort,
  ModelSelection,
  ModelDescriptor,
  Message,
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
  ToolSpec,
  ToolCallContent,
  TokenUsage,
  FinishReason,
  InferenceRequest,
  InferenceEvent,
  InferenceStream,
} from './types.js';

export type {
  ResolvedAuth,
  OAuthCredential,
  CredentialInfo,
  CredentialStore,
  AuthInteraction,
  AuthPrompt,
  AuthEvent,
  AuthStatus,
} from './auth/types.js';

// Runtime
export {
  createAIEngine,
  streamInference,
  type AIEngine,
  type AIEngineOptions,
} from './inference.js';

// Models
export {
  getProviderDescriptor,
  PROVIDER_REGISTRY,
  type ProviderDescriptor,
  type WireProtocol,
} from './models/registry.js';

export {
  resolveModelSelection,
  inferProviderFromModelId,
  PROVIDER_SELECTION_PRIORITY,
  CANONICAL_DEFAULT_EFFORT,
  type ModelSelectionRequest,
} from './models/selection.js';

export {
  fetchAvailableModels,
  type DiscoveredModel,
  type ModelDiscoveryResult,
  type ProviderDiscoveryStatus,
} from './models/discovery.js';

// Auth
export { generatePKCE } from './auth/pkce.js';
export { createFileCredentialStore, FileCredentialStore } from './auth/store.js';
export { createAuthManager, DefaultAuthManager, type AuthManager } from './auth/manager.js';
export { startOAuthCallbackServer, type OAuthCallbackServer } from './auth/callback-server.js';

// Errors
export { AIError, type AIErrorCode, type AIErrorOptions } from './errors.js';

// JSON utilities
export { parseJson, parseStreamingJson } from './json.js';
