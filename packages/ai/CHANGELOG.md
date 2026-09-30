# Changelog - @steward/ai

All notable changes to the `@steward/ai` package will be documented in this file.

## [0.2.0] - 2026-09-30

### Breaking Changes
- **Pure API Key Auth:** Removed all complex OAuth flows, PKCE callback servers, and stateful credential stores (`InMemoryCredentialStore`, `src/auth/`). Replaced with a pure, priority-order API key resolver (`resolveApiKey`).
- **GitHub Copilot Provider Removed:** Dropped `github-copilot` provider and device-flow token exchange.
- **OpenRouter Standardized on Anthropic Messages:** OpenRouter wire protocol now exclusively routes through `anthropic-messages` (`https://openrouter.ai/api/v1/messages`).
- **Cleaned Legacy APIs:** Removed `src/inference.ts`, `src/stream.ts`, `src/json.ts`, `src/models/registry.ts`, `src/models/discovery.ts`, `src/providers/gemini.ts`.

### Added
- **Interactive Chat REPL:** Added `examples/chat.ts` (`bun run chat`) featuring in-memory multi-turn sessions, dynamic model switching (`.model`, `.effort`), provider auth checks (`.providers`), and catalog listing (`.list`).
- **models.dev Metadata & Static Catalog:** Added `src/models/models-dev.ts` parser and bundled `src/models/catalog.generated.ts` containing 400+ pre-seeded models with offline support and live refresh capabilities.
- **Full Multimodal Vision Support:** Added `ImageContent` and base64 image encoding across all 4 wire protocols (`anthropic-messages`, `openai-completions`, `openai-responses`, `google-generative-ai`) with automatic text placeholder fallback for non-vision models.
- **Standardized Error Classification:** Added `classifyHttpError` mapping HTTP status codes to canonical `AIError` domains (`auth`, `rate-limit`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`).
- **Token Usage & USD Cost Engine:** Added full token calculation (`input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, `total`) and per-model USD cost estimation.
- **Silent Context Overflow Detection:** Added `isContextOverflow` integration into `AssistantMessageStream`.

### Fixed
- **Usage Extraction:** Fixed token extraction across varying provider SSE chunk formats (supporting `message_start`, `message_delta`, and top-level `usage` payloads).
- **Tool ID Sanitization:** Standardized foreign tool call ID normalization during cross-model handoff.
- **Base URL Normalization:** Prevented duplicated `/v1/v1` URL paths across all protocol adapters.
