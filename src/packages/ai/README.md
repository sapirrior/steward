# A sub package named ai for Steward for first-party AI runtime, inference streaming, and authentication

This package is responsible for provider protocol adapters (`openai`, `anthropic`, `gemini`, `deepseek`, `openrouter`, `github-copilot`, `groq`, `xai`, `mistral`, `ollama`, `custom`), message normalization, streaming inference, credential management, PKCE, device code flow, OAuth callback server, and dynamic model discovery. It is self-contained and does not import from `@steward/agents`, `@steward/services`, `@steward/tui`, or external AI SDKs (`ai`, `@ai-sdk/*`).

---

## File & Function Breakdown

### Root Modules (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `index.ts` | `*` | Entry Point | Re-exports all public domain types, runtime factories, models, auth, and error classes. | Clean boundary; does not expose internal wire parsers. |
| `types.ts` | `ProviderId` | Type | Canonical 11-provider identifier union (`openai`, `anthropic`, `gemini`, `deepseek`, `openrouter`, `github-copilot`, `groq`, `xai`, `mistral`, `ollama`, `custom`). | Fixed set; no unused legacy providers. |
| | `ReasoningEffort` | Type | Canonical 4-tier effort (`none`, `low`, `medium`, `high`). | No `provider-default`, `minimal`, or `xhigh`. |
| | `ModelSelection` | Interface | Normalized model choice tuple `{ provider, modelId, effort }`. | `effort` is mandatory in new contracts. |
| | `Message` | Type | Provider-neutral message union (`SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`). | Plain JSON serializable; independent of any external SDK. |
| | `ToolSpec` | Interface | Serializable tool declaration `{ name, description, inputSchema }`. | Contains plain JSON Schema without Zod dependencies. |
| | `TokenUsage` | Interface | Canonical token metrics `{ inputTokens, outputTokens, totalTokens, ... }`. | Normalized across all frontier providers. |
| | `InferenceEvent` | Type | Streaming event union (`text-delta`, `reasoning-delta`, `tool-call-start`, `tool-call-delta`, `tool-call-end`, `done`, `error`). | Event contract emitted by provider streams. |
| | `InferenceStream` | Interface | Async iterable stream yielding `InferenceEvent` and providing `.result()`. | Self-draining promise result on demand. |
| `errors.ts` | `AIError` | Class | Single serializable error family with typed `AIErrorCode`. | Never embeds secret tokens or full raw request headers. |
| | `AIErrorCode` | Type | Code union: `auth`, `oauth`, `network`, `rate-limit`, `invalid-request`, `provider`, `parse`, `aborted`. | Clean machine-readable classifier. |
| `json.ts` | `parseJson` | Function | Strict JSON parser wrapped in `AIError`. | Throws typed `AIError` with code `parse`. |
| | `parseStreamingJson` | Function | Incremental JSON parser with automatic bracket/quote closing. | Allows emitting partial tool argument objects during streaming. |
| `stream.ts` | `decodeSSE` | Function | Provider-neutral SSE decoder over `ReadableStream<Uint8Array>`. | Handles multi-line data, `\r\n`, comments, and trailing flushes. |
| `inference.ts` | `streamInference` | Function | Public streaming inference engine resolving auth and dispatching to wire adapters. | Normalizes events and returns canonical `AssistantMessage`. |
| | `createAIEngine` | Function | Instantiates a stateful `AIEngine` runtime sharing an auth manager instance. | Injected into app and session lifecycle. |

---

### Auth Modules (`src/auth/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `types.ts` | `OAuthCredential` | Interface | Stored OAuth credential `{ type, accessToken, refreshToken?, expiresAt? }`. | Permanent keys use `expiresAt: Infinity`. |
| | `ResolvedAuth` | Interface | Resolved execution credential `{ type, token, headers?, source }`. | Used by wire adapters to sign HTTP requests. |
| | `AuthInteraction` | Interface | Interaction-neutral UI contract for OAuth prompts and progress events. | Exposes `prompt` and `notify`; no UI coupling. |
| `pkce.ts` | `generatePKCE` | Function | Web Crypto PKCE generator producing verifier and SHA-256 base64url challenge. | Standard 32-byte entropy. |
| `device-code.ts` | `pollDeviceCode` | Function | Polling helper for RFC 8628 OAuth 2.0 Device Authorization Grant. | Handles slow down, expired tokens, and polling intervals. |
| `callback-server.ts` | `startOAuthCallbackServer` | Function | Loopback HTTP callback listener on provider-specified host/port. | Validates state, cleans up on completion or abort. |
| `store.ts` | `FileCredentialStore` | Class | Secure disk persistence at `~/.steward/auth.json` (mode `0600`, dir `0700`). | Atomic temp-file write and rename with per-provider mutex. |
| `resolver.ts` | `AuthResolver` | Class | Resolves stored OAuth credential with double-checked near-expiry refresh. | Falls back to static env keys only when no OAuth credential exists. |
| `manager.ts` | `DefaultAuthManager` | Class | Central coordinator for login, logout, credential listing, and status reporting. | Serializes OAuth operations; exposes `getStatus`. |
| `oauth/anthropic.ts` | `loginAnthropic` | Function | Anthropic PKCE OAuth flow on fixed callback `http://localhost:53692/callback`. | Exchanges code at `platform.claude.com/v1/oauth/token`. |
| | `refreshAnthropic` | Function | Token refresh for Anthropic OAuth credentials. | Double-checked before expiry. |
| `oauth/openrouter.ts` | `loginOpenRouter` | Function | OpenRouter PKCE OAuth flow on `http://127.0.0.1:8085/oauth/callback`. | Exchanges authorization code for permanent user API key. |
| `oauth/github-copilot.ts` | `loginGitHubCopilot` | Function | GitHub Copilot Device Code flow (`https://github.com/login/device/code`). | Obtains and refreshes Copilot session tokens (`api.githubcopilot.com`). |

---

### Model Modules (`src/models/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `registry.ts` | `PROVIDER_REGISTRY` | Constant | Catalog of 11 supported providers, default models, protocols, and env vars. | Single source of truth for provider capabilities. |
| | `getProviderDescriptor` | Function | Looks up descriptor for a given `ProviderId`. | Throws on unknown provider ID. |
| `selection.ts` | `resolveModelSelection` | Function | Resolves active model based on request, saved settings, and priority. | Enforces canonical default effort (`medium`). |
| | `inferProviderFromModelId` | Function | Heuristic prefix matching (`claude-*`, `gemini-*`, `gpt-*`, `deepseek-*`, `grok-*`, `codestral*`, `mistral*`, `ollama/`, namespaced). | Returns canonical `ProviderId`. |
| `discovery.ts` | `fetchAvailableModels` | Function | Queries remote `/models` endpoints across configured providers. | Filters out non-chat, audio, image, and embedding models. |

---

### Provider Wire Adapters (`src/providers/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic.ts` | `streamAnthropic` | Function | Native Anthropic `/v1/messages` SSE stream adapter. | Supports thinking budgets, signatures, and sequential tool calls. |
| `gemini.ts` | `streamGemini` | Function | Google Gemini `streamGenerateContent?alt=sse` adapter. | Normalizes `thought` parts to reasoning deltas and maps function calls with thought signatures. |
| `openai.ts` | `streamOpenAI` | Function | OpenAI Chat Completions streaming adapter with reasoning effort. | Normalizes tool calls and token usage details. |
| `openai-compatible.ts` | `streamOpenAICompatible` | Function | Generic OpenAI-compatible streaming adapter for DeepSeek, OpenRouter, GitHub Copilot, Groq, xAI, Mistral, Ollama, and Custom. | Handles `reasoning_content`, `reasoning_details`, and custom local endpoints. |

---

## Architecture & Invariants

1. **Zero External AI Dependencies**: Uses only native runtime APIs (`fetch`, Web Streams, Web Crypto, Node HTTP).
2. **Strict Reasoning Effort**: All public contracts, commands, and persistence use exactly `none`, `low`, `medium`, `high`.
3. **Double-Checked OAuth Refresh**: Refreshes credentials automatically within the 5-minute expiry window under a serialized file/memory lock.
4. **Credential Isolation**: Secrets are never logged, never rendered by TUI, and never returned in error strings.
