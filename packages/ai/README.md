# @steward/ai

Zero-dependency, pure Web Standards AI streaming inference engine and model orchestrator for terminal engineering assistants and agent runtimes.

`@steward/ai` connects directly to frontier LLM APIs over raw `fetch` and Server-Sent Events (SSE) with **zero runtime dependencies**. It provides unified streaming, tool calling, reasoning/thinking controls, vision input support, cross-model message translation, dynamic `models.dev` catalog discovery, and resilient error recovery.

---

## Table of Contents

- [Features](#features)
- [Supported Providers & Protocols](#supported-providers--protocols)
- [Quick Start](#quick-start)
- [Interactive Chat REPL](#interactive-chat-repl)
- [Streaming & Event Handling](#streaming--event-handling)
- [Tool Calling](#tool-calling)
- [Thinking & Reasoning](#thinking--reasoning)
- [Cross-Model Message Transformation](#cross-model-message-transformation)
- [models.dev Dynamic Catalog](#modelsdev-dynamic-catalog)
- [Package API Reference (Sonnet Convention)](#package-api-reference)
- [Architectural Invariants](#architectural-invariants)

---

## Features

- **Zero External AI SDKs:** No `@ai-sdk/*`, `openai`, `@anthropic-ai/sdk`, or `langchain`. Direct, high-performance streaming over standard Web `fetch` and `ReadableStream`.
- **Pure Web Standards:** Built entirely on standard JavaScript/TypeScript primitives (`fetch`, `Headers`, `ReadableStream`, `TextDecoder`). Works natively in Bun, Node.js 22+, Deno, and edge runtimes.
- **Offline-First Seeded Catalog:** Ships with a static, pre-generated catalog of over 400+ frontier and open-source models parsed from `models.dev`, with live on-demand refresh support.
- **OpenRouter Exclusivity:** Fully standardized OpenRouter integration via Anthropic Messages protocol (`https://openrouter.ai/api/v1/messages`).
- **Canonical Reasoning Scale:** 5-tier reasoning effort scale (`'none'`, `'low'`, `'medium'`, `'high'`, `'xhigh'`) with automatic fallback clamping and Anthropic token budget calculation.
- **Cross-Model Handoff:** Seamlessly re-routes conversation history across OpenAI, Anthropic, Google, and OpenRouter—automatically normalizing tool IDs, synthesizing orphaned tool call results, and preserving or converting thinking blocks.
- **Resilient Error Classification:** Automatic classification of HTTP errors (`rate-limit`, `auth`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`) with silent exponential backoff before the first byte.

---

## Supported Providers & Protocols

| Provider ID | Protocol | Endpoint | Auth Env Var / Scheme | Thinking / Reasoning | Tool Calling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `anthropic` | `anthropic-messages` | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` (`x-api-key`) | `thinking.budget_tokens` | Native |
| `openai` | `openai-completions` / `openai-responses` | `https://api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` (`Bearer`) | `reasoning_effort` | Native |
| `google` | `google-generative-ai` | `https://generativelanguage.googleapis.com` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` (`x-goog-api-key`) | `thinkingConfig.thinkingBudget` | Function Declarations |
| `openrouter` | `anthropic-messages` | `https://openrouter.ai/api/v1/messages` | `OPENROUTER_API_KEY` (`Bearer`) | `thinking.budget_tokens` | Native |
| *Custom* | `openai-completions` / *any* | Configurable | API Key / Bearer | Provider-dependent | Supported |

---

## Quick Start

```typescript
import { createAI } from '@steward/ai';

// 1. Instantiate AI client (resolves API keys from environment)
const ai = createAI();

// 2. Stream inference with auto-resolved model or explicit selection
const stream = ai.stream({
  model: { provider: 'anthropic', modelId: 'claude-3-5-sonnet-20241022', effort: 'medium' },
  messages: [
    { role: 'user', content: 'Explain distributed consensus in two sentences.' },
  ],
});

// 3. Consume streaming events in real time
for await (const event of stream) {
  if (event.type === 'reasoning-delta') {
    process.stdout.write(`\x1b[90m${event.delta}\x1b[0m`);
  } else if (event.type === 'text-delta') {
    process.stdout.write(event.delta);
  }
}

// 4. Retrieve canonical result and usage stats
const result = await stream.result();
console.log(`\nTokens used: ${result.usage.total} (in: ${result.usage.input}, out: ${result.usage.output})`);
```

---

## Interactive Chat REPL

`@steward/ai` includes a full-featured interactive terminal REPL for quick testing and model exploration:

```bash
bun run chat
```

### REPL Commands:
- `.list [provider]` — List available models for configured providers (or a specific provider) with max tokens, vision, and thinking capabilities.
- `.providers` — List all registered providers and current API key configuration status.
- `.model <provider:modelId>` or `.model <modelId>` — Dynamically switch active model (e.g. `.model openrouter/free` or `.model gpt-5.4`).
- `.effort <none|low|medium|high|max>` — Adjust reasoning / thinking effort.
- `.history` — View in-memory conversation turns.
- `.clear` — Reset in-memory session.
- `.help` / `.exit` — Show command help or exit.

---

## Streaming & Event Handling

The `ai.stream()` method returns an `InferenceStream` implementing `AsyncIterable<InferenceEvent>` and `.result()`:

```typescript
export type InferenceEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'done'; message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason }
  | { type: 'error'; error: AIError; partial?: AssistantMessage };
```

> **Contract Guarantee:** `ai.stream()` never throws synchronously, and `stream.result()` never rejects. All errors (auth failure, network drop, context overflow) surface as `{ type: 'error' }` stream events.

---

## Tool Calling

```typescript
const stream = ai.stream({
  model: { provider: 'openai', modelId: 'gpt-4o', effort: 'none' },
  messages: [{ role: 'user', content: 'What files are in the current directory?' }],
  tools: [
    {
      name: 'list_files',
      description: 'List files in a directory',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path' },
        },
        required: ['path'],
      },
    },
  ],
});
```

---

## models.dev Dynamic Catalog

`@steward/ai` uses metadata from [`models.dev`](https://models.dev) to provide accurate token limits, pricing, context windows, and reasoning capabilities:

- **Offline Seeded:** 400+ models bundled in `src/models/catalog.generated.ts`.
- **OpenRouter Support:** Fully captures OpenRouter's catalog including free models (`openrouter/free`, `google/gemma-4-26b-a4b-it:free`, etc.).
- **Live Refresh:** `ai.refreshCatalog()` dynamically updates the cache when online with ETag support.

To re-generate the static bundled catalog:
```bash
bun run catalog:update
```

---

## Package API Reference

Documentation organized according to the **Sonnet Convention** (*File $\to$ Export $\to$ Type $\to$ Description & Constraints*):

### 1. `src/auth.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `resolveApiKey` | `(provider: string, opts?: AuthOptions) => Promise<ResolvedAuth>` | Resolves API keys with pure priority order: `opts.apiKey` $\to$ `opts.apiKeys[provider]` $\to$ `opts.getApiKey()` $\to$ environment variables. Throws `AIError('auth')` if missing and not keyless. |
| `defaultEnvGetter` | `AuthEnvGetter` | Default environment variable reader accessing `process.env`. |
| `ResolvedAuth` | `interface` | Result object containing resolved `apiKey`, `source`, and `scheme`. |

### 2. `src/client.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `createAI` | `(opts?: CreateAIOptions) => AI` | Creates the central AI runtime object. Seeds builtin providers and static model catalog. |
| `AI` | `interface` | Core interface providing `.stream()`, `.complete()`, `.models()`, `.availableModels()`, `.resolveModel()`, and `.refreshCatalog()`. |
| `Provider` | `interface` | Provider descriptor holding ID, protocol streams map, base URL, and auth rules. |

### 3. `src/event-stream.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `AssistantMessageStream` | `class implements InferenceStream` | Async iterable queue orchestrating stream events. Manages token usage calculation, silent context overflow detection, USD cost evaluation, and accumulator building for `.result()`. |

### 4. `src/errors.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `AIError` | `class extends Error` | Standardized domain error with `code: AIErrorCode` (`auth`, `rate-limit`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`, `tool-call`). |
| `classifyHttpError` | `(status: number, detail?: string, provider?: ProviderId, cause?: unknown) => AIError` | Classifies HTTP status codes into canonical `AIError` domains. |

### 5. `src/models/catalog.ts` & `src/models/models-dev.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `MODELS` | `readonly Model[]` | Pre-generated catalog of frontier and open-source models. |
| `PROVIDER_PRESETS` | `readonly ProviderPreset[]` | Third-party provider presets (DeepSeek, Groq, xAI, Mistral, Ollama, LM Studio). |
| `parseModelsDevModel` | `(providerId, raw) => Model` | Parses raw `models.dev` API model definition into canonical `Model`. |
| `supportsReasoning` | `(model: Model) => boolean` | Checks if model supports reasoning / thinking. |
| `filterModels` | `(models: readonly Model[], filter: ModelFilter) => Model[]` | Filters models by provider, query string, or reasoning support. |

### 6. `src/models/selection.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `resolveModelSelection` | `(req?, ctx?) => Promise<ModelSelection>` | Resolves requested model or infers best available configured model in priority order: Anthropic $\to$ OpenAI $\to$ Google $\to$ OpenRouter. |
| `inferProviderFromModelId` | `(modelId: string) => ProviderId \| null` | Heuristically infers provider from model ID prefixes. |

### 7. `src/models/thinking.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `clampThinkingEffort` | `(model: Model, requested: ReasoningEffort) => ReasoningEffort` | Clamps reasoning effort to model's supported levels. |
| `calculateAnthropicBudgetTokens` | `(effort: ReasoningEffort, maxOutputTokens: number) => number \| undefined` | Computes token budget for Anthropic thinking models. |

### 8. `src/transform/messages.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `transformMessages` | `(messages: readonly Message[], targetModel: Model) => Message[]` | Normalizes message history for cross-model handoff. Converts foreign thinking blocks, drops redacted blocks, normalizes tool call IDs to `^[a-zA-Z0-9_-]{1,64}$`, and fixes orphaned tool calls. |

### 9. `src/protocols/index.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `anthropicMessagesProtocol` | `ProtocolStream` | Wire adapter for Anthropic Messages API (`/v1/messages`). Used by Anthropic and OpenRouter. |
| `openaiCompletionsProtocol` | `ProtocolStream` | Wire adapter for OpenAI Chat Completions API (`/v1/chat/completions`). |
| `openaiResponsesProtocol` | `ProtocolStream` | Wire adapter for OpenAI Responses API (`/v1/responses`). |
| `googleGenerativeAIProtocol` | `ProtocolStream` | Wire adapter for Google Gemini REST API (`/v1beta/models/...:streamGenerateContent`). |

### 10. `src/util/cost.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `calculateCost` | `(model: Model, usage: TokenUsage) => TokenCost \| undefined` | Calculates exact USD cost breakdown (input, output, cache-read, cache-write, total). |

---

## Architectural Invariants

1. **Zero External AI Dependencies:** All LLM communication, SSE parsers, and wire protocols remain strictly within `@steward/ai` using native Web Standards.
2. **Never Throw in Streaming:** `ai.stream()` never throws synchronously; errors are delivered as `{ type: 'error' }` events, ensuring agent turn loops remain resilient.
3. **OpenRouter Protocol:** OpenRouter communicates exclusively over `anthropic-messages` protocol.
4. **Offline Resilience:** All essential models and providers operate offline with the bundled static catalog.
