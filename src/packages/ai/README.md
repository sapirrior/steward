# @steward/ai

A zero-dependency, pure Web Standards AI engine and model orchestrator for terminal engineering assistants and agent runtimes.

`@steward/ai` connects directly to frontier LLM APIs over raw `fetch` and Server-Sent Events (SSE) with zero runtime dependencies. It supports native streaming, tool execution, thinking/reasoning budgets, cross-model message transformation, live `models.dev` catalog discovery, and resilient authentication.

---

## Table of Contents

- [Features](#features)
- [Supported Providers](#supported-providers)
- [Quick Start](#quick-start)
- [Streaming & Event Handling](#streaming--event-handling)
- [Tool Calling](#tool-calling)
- [Thinking & Reasoning](#thinking--reasoning)
- [Cross-Model Message Transformations](#cross-model-message-transformations)
- [Dynamic `models.dev` Catalog](#dynamic-modelsdev-catalog)
- [Custom Providers](#custom-providers)
- [Authentication & Credential Management](#authentication--credential-management)
- [Error Handling](#error-handling)
- [File & Function Breakdown](#file--function-breakdown)
- [Architectural Invariants](#architectural-invariants)

---

## Features

- **Zero External AI SDKs:** No `@ai-sdk/*`, `openai`, `@anthropic-ai/sdk`, or `langchain`. Direct, high-performance streaming over standard `fetch` and `ReadableStream`.
- **Pure Web Standards Core:** Built entirely on Web Platform APIs (`fetch`, `Headers`, `ReadableStream`, `TransformStream`, Web Crypto `crypto.subtle`). Runs seamlessly in Node.js 22+, Bun, Deno, or edge workers.
- **In-Memory & Pure Library Design:** No hardcoded filesystem persistence or hidden state. Authentication stores and contexts are strictly injected.
- **Dynamic Live Catalog:** Queries `models.dev` with live ETag caching, filtering for tool-capable, non-deprecated text models.
- **Canonical Reasoning Scale:** 5-tier reasoning effort scale (`'none'`, `'low'`, `'medium'`, `'high'`, `'xhigh'`) with automatic fallback clamping and Anthropic token budget math.
- **Cross-Model Message Normalization:** Seamlessly passes conversation history across OpenAI, Anthropic, and Google models—automatically cleaning orphan tool calls, sanitizing tool IDs (`^[a-zA-Z0-9_-]{1,64}$`), pruning incomplete turns, and pairing tool results.
- **Multi-Protocol Architecture:** Modular wire adapters for `anthropic-messages`, `openai-completions`, `openai-responses`, and `google-generative-ai`.

---

## Supported Providers

| Provider ID | Protocol | Auth Type | Thinking / Reasoning | Tool Calling |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic` | `anthropic-messages` | API Key | `thinking.budget_tokens` | Native |
| `openai` | `openai-completions` / `responses` | API Key | `reasoning_effort` | Native |
| `google` | `google-generative-ai` | API Key (`x-goog-api-key`) | `thinkingConfig.thinkingBudget` | Function Declarations |
| `github-copilot` | `openai-completions` | OAuth Device Flow (token exchange) | `reasoning_effort` | Native |
| `openrouter` | `openai-completions` | API Key / OAuth PKCE | `reasoning.effort` / `extra_body` | Native |
| *Custom* | `openai-completions` / *any* | API Key / Bearer | Provider-dependent | Supported |

---

## Quick Start

```typescript
import { createAI, builtinProviders, InMemoryCredentialStore } from '@steward/ai';

// 1. Initialize in-memory credential store
const store = new InMemoryCredentialStore();
await store.modify('anthropic', async () => ({
  type: 'api-key',
  key: process.env.ANTHROPIC_API_KEY!,
}));

// 2. Instantiate AI client
const ai = createAI({
  providers: builtinProviders(),
  credentials: store,
});

// 3. Stream a completion
const stream = ai.stream({
  model: {
    id: 'claude-3-7-sonnet-latest',
    provider: 'anthropic',
    name: 'Claude 3.7 Sonnet',
    protocol: 'anthropic-messages',
    baseUrl: 'https://api.anthropic.com',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    reasoning: true,
    cost: { input: 3, output: 15 },
  },
  messages: [
    { role: 'user', content: 'Explain quantum computing in three sentences.' },
  ],
  effort: 'medium',
});

// 4. Consume events as they arrive
for await (const event of stream) {
  if (event.type === 'reasoning-delta') {
    process.stdout.write(`[Thinking] ${event.delta}`);
  } else if (event.type === 'text-delta') {
    process.stdout.write(event.delta);
  }
}

// 5. Retrieve final canonical assistant message and usage
const result = await stream.result();
const totalTokens = (result.usage?.input ?? 0) + (result.usage?.output ?? 0);
console.log('\nTotal Tokens:', totalTokens);
if (result.usage?.cost) {
  console.log('Estimated Cost ($):', result.usage.cost.total);
}
```

---

## Streaming & Event Handling

The inference stream is an async iterable that yields normalized `InferenceEvent` items:

```typescript
type InferenceEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'done'; message: AssistantMessage; usage?: TokenUsage }
  | { type: 'error'; error: AIError };
```

### Self-Draining Contract (`stream.result()`)

`stream.result()` never rejects. Even if the consumer aborts, encounters an error, or stops iterating early, `.result()` returns an `InferenceResult`:

```typescript
const result = await stream.result();
if (result.error) {
  console.error('Inference failed:', result.error.message, result.error.code);
} else {
  console.log('Final Assistant Message:', result.message);
}
```

---

## Tool Calling

Tools are defined using standard JSON Schema declarations:

```typescript
import type { ToolSpec } from '@steward/ai';

const tools: ToolSpec[] = [
  {
    name: 'get_weather',
    description: 'Get current weather conditions for a location',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City and state/country' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
];

const stream = ai.stream({
  model,
  messages: [{ role: 'user', content: "What's the weather in Tokyo?" }],
  tools,
});

const result = await stream.result();

// If the assistant requested tools:
for (const block of result.message.content) {
  if (block.type === 'tool-call') {
    console.log(`Tool requested: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

---

## Thinking & Reasoning

Reasoning efforts are strictly standardized into 5 levels:

```typescript
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
```

- **Clamping:** Providers with limited reasoning options are automatically clamped using `clampThinkingEffort(model, requestedEffort)`.
- **Budget Math:** Anthropic token budgets are computed via `calculateAnthropicBudgetTokens(effort, maxTokens)`:
  - `low`: $\min(2048, \lfloor\text{maxTokens} \times 0.25\rfloor)$ (min 1024)
  - `medium`: $\min(8192, \lfloor\text{maxTokens} \times 0.50\rfloor)$ (min 1024)
  - `high` / `xhigh`: $\min(32000, \lfloor\text{maxTokens} \times 0.80\rfloor)$ (min 1024)

---

## Cross-Model Message Transformations

When switching between providers (e.g. OpenAI $\to$ Claude $\to$ Gemini), differences in wire format can cause API errors. `transformMessages()` normalizes the message stream:

```typescript
import { transformMessages } from '@steward/ai';

const sanitized = transformMessages(rawMessages, targetModel);
```

### Transformation Invariants:
1. **Tool ID Sanitization:** Rewrites tool call IDs to alphanumeric + `_` + `-` (max 64 chars) and synchronizes corresponding `tool` result messages.
2. **Orphan Tool Call Pruning / Synthesizing:** Any tool call lacking a corresponding result generates a synthetic cancellation result so the turn is valid.
3. **Incomplete Turn Pruning:** Strips trailing unfinished assistant/tool turns at conversation boundaries.
4. **Canonical Block Ordering:** Preserves exact encounter order (`thinking` $\to$ `text` $\to$ `tool-call` $\to$ `text`).

---

## Dynamic `models.dev` Catalog

`@steward/ai` dynamically discovers models from `models.dev` without hardcoded static lists:

```typescript
import { fetchModelsDevCatalog } from '@steward/ai';

const models = await fetchModelsDevCatalog({
  fetch: globalThis.fetch,
  apiUrl: 'https://models.dev/api.json',
  // Includes caching with 1-hour TTL and If-None-Match ETag support
});

// Returns Model[] filtered for active, tool_call-enabled, text-input models
```

---

## Custom Providers

Create custom OpenAI-compatible providers (Ollama, vLLM, DeepSeek, Groq, Mistral, xAI, LocalAI) using the `openAICompatibleProvider` factory:

```typescript
import { openAICompatibleProvider, createAI } from '@steward/ai';

const localProvider = openAICompatibleProvider({
  id: 'custom',
  name: 'Local Ollama',
  defaultBaseUrl: 'http://localhost:11434/v1',
  envKey: 'OLLAMA_API_KEY',
});

const ai = createAI({
  providers: [localProvider],
});
```

---

## Authentication & Credential Management

Authentication is stateless and non-blocking. Store credentials in any custom `CredentialStore` implementation:

```typescript
import type { CredentialStore, Credential, CredentialInfo, ProviderId } from '@steward/ai';

class CustomDatabaseStore implements CredentialStore {
  private db = new Map<ProviderId, Credential>();

  async read(provider: ProviderId): Promise<Credential | undefined> {
    return this.db.get(provider);
  }

  async modify(
    provider: ProviderId,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    const current = await this.read(provider);
    const next = await fn(current);
    if (next !== undefined) {
      this.db.set(provider, next);
    }
    return next;
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return [...this.db.entries()].map(([provider, cred]) => ({
      provider,
      type: cred.type,
      expiresAt: cred.type === 'oauth' ? cred.expiresAt : undefined,
    }));
  }

  async delete(provider: ProviderId): Promise<void> {
    this.db.delete(provider);
  }
}
```

---

## Error Handling

All runtime errors are categorized under a single `AIError` class with structured error codes:

```typescript
import { AIError, type AIErrorCode } from '@steward/ai';

try {
  const stream = ai.stream({ ... });
  for await (const event of stream) { /* ... */ }
} catch (err) {
  if (err instanceof AIError) {
    switch (err.code) {
      case 'rate-limit':
        console.warn(`Rate limited. Status: ${err.status}`);
        break;
      case 'context-overflow':
        console.error('Prompt exceeds context window limit.');
        break;
      case 'auth':
        console.error('Invalid or expired credentials.');
        break;
    }
  }
}
```

### Error Code Summary:
- `auth`: Missing, malformed, or invalid API key / token (HTTP 401/403).
- `oauth`: OAuth exchange, device flow timeout, or refresh failure.
- `rate-limit`: HTTP 429 rate limit exceeded.
- `context-overflow`: Model context window exceeded.
- `invalid-request`: HTTP 400 bad request / validation error.
- `provider`: Downstream upstream 5xx server error.
- `network`: DNS resolution or connection failure.
- `parse`: Failed to decode SSE or parse JSON response.
- `aborted`: Request aborted via `AbortSignal`.

---

## File & Function Breakdown

### Root Modules (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `index.ts` | `*` | Entry Point | Re-exports public domain types, runtime factories, models, auth, and error classes. | Clean boundary; wire protocols and utilities are exported cleanly. |
| `types.ts` | `ProviderId` | Type | Provider identifier union (`'anthropic'`, `'openai'`, `'google'`, `'github-copilot'`, `'openrouter'`, `'custom'`). | Built-in provider IDs. |
| | `ReasoningEffort` | Type | 5-tier reasoning effort (`'none'`, `'low'`, `'medium'`, `'high'`, `'xhigh'`). | Normalized reasoning scale. |
| | `Message` | Type | Message union (`SystemMessage`, `UserMessage`, `AssistantMessage`, `ToolMessage`). | Pure JSON serializable; independent of SDKs. |
| | `ToolSpec` | Interface | Tool specification `{ name, description, inputSchema }`. | Pure JSON Schema without Zod dependencies. |
| | `InferenceEvent` | Type | Streaming event union (`text-delta`, `reasoning-delta`, `tool-call-*`, `done`, `error`). | Emitted by provider streams. |
| | `InferenceStream` | Interface | Async iterable stream yielding `InferenceEvent` and providing `.result()`. | Self-draining promise result on demand. |
| `client.ts` | `createAI` | Function | Factory creating an `AI` client instance with configured providers and stores. | Main client runtime entry point. |
| | `AI` | Interface | AI client contract (`stream`, `availableModels`, `authStatus`, `login`, `logout`). | Client instance API. |
| `event-stream.ts` | `AssistantMessageStream` | Class | Stream builder managing chunks, tool accumulation, and self-draining `.result()`. | Never rejects; handles abort and errors gracefully. |
| `errors.ts` | `AIError` | Class | Serializable error class with typed `AIErrorCode`. | Never embeds raw secrets or full request bodies. |

### Auth Modules (`src/auth/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `types.ts` | `CredentialStore` | Interface | Pluggable credential storage interface (`read`, `modify`, `list`, `delete`). | Pure in-memory or custom storage. |
| | `ResolvedAuth` | Interface | Resolved HTTP headers and token for signing requests. | Injected into provider protocol adapters. |
| `resolve.ts` | `resolveAuth` | Function | Resolves credentials from store or environment with token refresh. | Double-checked refresh lock pattern. |
| `memory-store.ts` | `InMemoryCredentialStore`| Class | In-memory `CredentialStore` with async transaction lock (`modify`). | Safe for tests and stateless runtimes. |
| `api-key.ts` | `envApiKeyAuth` | Function | Helper extracting API keys from environment variables. | Fallback when no stored credential exists. |
| `pkce.ts` | `generatePKCE` | Function | Generates code verifier and challenge using Web Crypto SHA-256. | Standard 32-byte entropy base64url. |
| `device-code.ts` | `pollOAuthDeviceCodeFlow`| Function | RFC 8628 OAuth 2.0 Device Code polling helper. | Handles slow down, poll intervals, and aborts. |
| `callback-server.ts`| `startOAuthCallbackServer` | Function | Loopback OAuth redirect handler executing token exchange before browser page. | Dynamic ephemeral port, dark mode success/error HTML. |

### Model & Catalog Modules (`src/models/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `catalog.ts` | `fetchModelsDevCatalog` | Function | Fetches and parses live model definitions from `models.dev`. | Caches with TTL + ETag; filters non-chat/deprecated models. |
| `thinking.ts` | `clampThinkingEffort` | Function | Maps requested effort to closest supported model effort. | Fallback clamping logic. |
| | `calculateAnthropicBudgetTokens` | Function | Computes Anthropic `budget_tokens` from effort and `maxTokens`. | Min 1024 tokens. |
| `selection.ts` | `resolveModelSelection` | Function | Resolves model selection from requested provider/model or defaults. | Enforces canonical default effort. |

### Message Transformation (`src/transform/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `messages.ts` | `transformMessages` | Function | Normalizes conversation history for target model protocol. | Sanitizes tool IDs, repairs orphan calls, prunes incomplete turns. |

### Protocol Adapters (`src/protocols/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic-messages.ts` | `anthropicMessagesProtocol` | Constant | Native Anthropic `/v1/messages` SSE stream adapter. | Supports thinking budgets and prompt caching. |
| `openai-completions.ts` | `openAICompletionsProtocol` | Constant | OpenAI Chat Completions `/v1/chat/completions` SSE adapter. | Reasoning effort, tool streaming, usage extraction. |
| `openai-responses.ts` | `openAIResponsesProtocol` | Constant | OpenAI Responses API `/v1/responses` SSE adapter. | Supports new Responses wire format. |
| `google-generative-ai.ts`| `googleGenerativeAIProtocol`| Constant | Google Gemini `streamGenerateContent?alt=sse` adapter. | Header-based auth (`x-goog-api-key`), thinking budget. |

### Providers (`src/providers/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic.ts` | `anthropicProvider` | Constant | Provider descriptor for Anthropic Claude. | Uses `anthropic-messages` protocol. |
| `openai.ts` | `openAIProvider` | Constant | Provider descriptor for OpenAI GPT/o-series. | Uses `openai-completions` protocol. |
| `google.ts` | `googleProvider` | Constant | Provider descriptor for Google Gemini. | Uses `google-generative-ai` protocol with API key auth. |
| `github-copilot.ts` | `githubCopilotProvider` | Constant | Provider descriptor for GitHub Copilot. | Device flow auth and dynamic model filtering. |
| `openrouter.ts` | `openRouterProvider` | Constant | Provider descriptor for OpenRouter. | OAuth PKCE / API key with dynamic catalog support. |
| `openai-compatible.ts` | `openAICompatibleProvider` | Function | Factory for OpenAI-compatible endpoints. | Configurable base URL, custom headers, and models. |
| `index.ts` | `builtinProviders` | Function | Returns array of standard built-in providers. | Default provider catalog. |

---

## Architectural Invariants

1. **Zero External SDK Dependencies:** Only native runtime APIs (`fetch`, Web Streams, Web Crypto).
2. **Pure In-Memory Core:** No filesystem I/O inside `@steward/ai`. Storage is strictly injected.
3. **Safe Secrets & Error Boundaries:** Raw authorization headers, API keys, and unparsed HTTP error response bodies are never leaked into error messages or stack traces.
4. **Header-Based Google Authentication:** Google API keys are passed strictly via `x-goog-api-key` headers rather than URL query parameters to avoid logging exposure.
5. **Lossless Encounter Ordering:** Stream chunks maintain strict encounter order (`thinking` $\to$ `text` $\to$ `tool-call` $\to$ `text`) across all provider adapters.
