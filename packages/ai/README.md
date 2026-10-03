# @steward/ai

AI streaming inference engine and model orchestrator for terminal engineering assistants and agent runtimes, powered by AI SDK v7.

`@steward/ai` provides a unified streaming abstraction, tool calling, reasoning/thinking controls, cross-model message translation, dynamic `models.dev` catalog discovery, and resilient error recovery across 10 built-in LLM providers and custom OpenAI-compatible endpoints.

---

## Table of Contents

- [Features](#features)
- [Supported Providers](#supported-providers)
- [Quick Start](#quick-start)
- [Streaming & Event Handling](#streaming--event-handling)
- [Tool Calling](#tool-calling)
- [Thinking & Reasoning](#thinking--reasoning)
- [models.dev Dynamic Catalog](#modelsdev-dynamic-catalog)
- [Package API Reference (Sonnet Convention)](#package-api-reference)
- [Architectural Invariants](#architectural-invariants)

---

## Features

- **Production-Grade Multi-Provider Inference:** Unified streaming inference across OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, Mistral, xAI Grok, OpenRouter, Ollama, and GitHub Copilot.
- **Configurable Transformer Architecture:** Decoupled translation seam between domain types and underlying model streaming protocol.
- **Dynamic Runtime Catalog:** Lightweight on-demand discovery from `models.dev` with in-memory caching (TTL & ETag).
- **Accurate Token Usage & Cost:** Uncached input token resolution (`noCacheTokens`) preventing cached token double-counting.
- **Canonical Reasoning Scale:** 5-tier reasoning effort scale (`'none'`, `'low'`, `'medium'`, `'high'`, `'xhigh'`) with automatic clamping and provider-native thinking replay.
- **Resilient Error Classification:** Standardized `AIError` taxonomy (`auth`, `rate-limit`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`, `parse`).

---

## Supported Providers

| Provider ID | Implementation Package | Default Model | Auth Env Var / Scheme | Thinking / Reasoning | Tool Calling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `anthropic` | `@ai-sdk/anthropic` | `claude-sonnet-4-5` | `ANTHROPIC_API_KEY` (`x-api-key`) | Native | Native |
| `openai` | `@ai-sdk/openai` | `gpt-4o` | `OPENAI_API_KEY` (`Bearer`) | Native | Native |
| `google` | `@ai-sdk/google` | `gemini-2.5-flash` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Native | Native |
| `deepseek` | `@ai-sdk/deepseek` | `deepseek-chat` | `DEEPSEEK_API_KEY` (`Bearer`) | Native | Native |
| `groq` | `@ai-sdk/groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` (`Bearer`) | Native | Native |
| `openrouter` | `@ai-sdk/openai-compatible` | `anthropic/claude-sonnet-4-5` | `OPENROUTER_API_KEY` (`Bearer`) | Native | Native |
| `grok` | `@ai-sdk/xai` | `grok-3` | `XAI_API_KEY` (`Bearer`) | Native | Native |
| `mistral` | `@ai-sdk/mistral` | `mistral-large-latest` | `MISTRAL_API_KEY` (`Bearer`) | Native | Native |
| `ollama` | `@ai-sdk/openai-compatible` | `llama3.2` | Keyless / local | Native | Native |
| `github-copilot` | `@ai-sdk/openai-compatible` | `gpt-4o` | `GITHUB_TOKEN` / `COPILOT_API_KEY` | Model-dependent | Native |
| *Custom* | `@ai-sdk/openai-compatible` | Configurable | API Key / Bearer / Keyless | Configurable | Native |

---

## Quick Start

```typescript
import { createAI } from '@steward/ai';

// 1. Instantiate AI client (resolves API keys from environment)
const ai = createAI();

// 2. Stream inference with auto-resolved model or explicit selection
const stream = ai.stream({
  model: { provider: 'anthropic', modelId: 'claude-sonnet-4-5', effort: 'medium' },
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

`@steward/ai` uses metadata from [`models.dev`](https://models.dev) to provide token limits, pricing, context windows, and reasoning capabilities:

- **Zero Bundled Bloat:** No static generated catalog files; dynamic models are fetched on-demand and kept purely in-memory.
- **In-Memory Caching:** `ai.refreshCatalog()` dynamically updates the cache when online with ETag and TTL support.
- **Resilient Fallbacks:** When offline or when `models.dev` is unreachable, explicit model inference and configured default provider models operate seamlessly.

---

## Package API Reference

Documentation organized according to the **Sonnet Convention** (*File $\to$ Export $\to$ Type $\to$ Description & Constraints*):

### 1. `src/auth.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `resolveApiKey` | `(provider: Provider, opts?: AuthOptions, requestApiKey?: string) => Promise<ResolvedAuth>` | Resolves API keys with pure priority order: `requestApiKey` $\to$ `opts.apiKeys[provider]` $\to$ `opts.getApiKey()` $\to$ environment variables. Throws `AIError('auth')` if unconfigured and not keyless. |
| `defaultEnvGetter` | `AuthEnvGetter` | Default environment variable reader accessing `process.env`. |
| `ResolvedAuth` | `interface` | Result object containing resolved `apiKey`, `source`, and `scheme`. |

### 2. `src/client.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `createAI` | `(opts?: CreateAIOptions) => AI` | Creates the central AI runtime object. Seeds builtin providers and manages dynamic runtime model discovery. |
| `AI` | `interface` | Core interface providing `.stream()`, `.complete()`, `.models()`, `.availableModels()`, `.resolveModel()`, and `.refreshCatalog()`. |
| `Provider` | `interface` | Provider descriptor holding ID, name, languageModel factory hook, base URL, and auth rules. |

### 3. `src/event-stream.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `AssistantMessageStream` | `class implements InferenceStream` | Async iterable queue orchestrating stream events. Manages token usage calculation, silent context overflow detection, USD cost evaluation, and accumulator building for `.result()`. |

### 4. `src/errors.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `AIError` | `class extends Error` | Standardized domain error with `code: AIErrorCode` (`auth`, `rate-limit`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`, `parse`). |
| `classifyHttpError` | `(status: number, detail?: string, provider?: ProviderId, cause?: unknown) => AIError` | Classifies HTTP status codes into canonical `AIError` domains. |

### 5. `src/provider/index.ts` & `src/provider/definitions.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `builtinProviders` | `() => Provider[]` | Instantiates all 10 built-in providers wired to their AI SDK language model factories. |
| `openAICompatibleProvider` | `(opts: OpenAICompatibleProviderOptions) => Provider` | Creates a custom OpenAI-compatible provider definition for local servers or proxies. |
| `PROVIDER_DEFINITIONS` | `readonly ProviderDefinition[]` | Declarative table of all built-in provider descriptors and factories. |

### 6. `src/transformer/index.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `normalizeMessages` | `(messages: readonly Message[]) => NormalizedMessagesResult` | Converts Steward messages to AI SDK `instructions` and `ModelMessage[]`. |
| `normalizeOptions` | `(request: InferenceRequest, model: Model, config: NamespaceConfig) => NormalizedCallParams` | Translates request parameters, reasoning effort, and temperature clamping. |
| `normalizeTools` | `(tools?: readonly ToolSpec[]) => ToolSet \| undefined` | Converts Steward tool specifications to AI SDK `ToolSet` via `jsonSchema()`. |
| `normalizeUsage` | `(sdkUsage: LanguageModelUsage) => TokenUsage` | Maps SDK usage to Steward `TokenUsage`, prioritizing `noCacheTokens`. |
| `normalizeFinishReason`| `(sdkReason?: string, hasToolCalls?: boolean) => FinishReason` | Maps SDK finish reasons to canonical Steward finish reasons. |
| `normalizeError` | `(err: unknown, providerId: ProviderId) => AIError` | Maps SDK and network errors to standardized `AIError`. |
| `pumpSdkStream` | `(sdkStream, stream, model, request) => Promise<void>` | Consumes `fullStream` and translates events into Steward `InferenceEvents`. |
| `MessageBuilder` | `class` | Incrementally accumulates stream parts into final `AssistantMessage`. |

### 7. `src/models/catalog.ts` & `src/models/models-dev.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `parseModelsDevModel` | `(providerId, raw) => Model` | Parses raw `models.dev` API model definition into canonical `Model`. |
| `supportsReasoning` | `(model: Model) => boolean` | Checks if model supports reasoning / thinking. |
| `filterModels` | `(models: readonly Model[], filter: ModelFilter) => Model[]` | Filters models by provider, query string, or reasoning support. |

### 8. `src/models/selection.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `resolveModelSelection` | `(req?, ctx?) => Promise<ModelSelection>` | Resolves requested model or infers best available configured model in priority order. |
| `inferProviderFromModelId` | `(modelId: string) => ProviderId \| null` | Heuristically infers provider from model ID prefixes. |
| `normalizeProviderId` | `(provider?: string) => ProviderId \| undefined` | Normalizes provider ID aliases (e.g. `'gemini'` $\to$ `'google'`, `'xai'` $\to$ `'grok'`). |

### 9. `src/models/thinking.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `clampThinkingEffort` | `(model: Model, requested: ReasoningEffort) => ReasoningEffort` | Clamps reasoning effort to model's supported levels. |
| `calculateAnthropicBudgetTokens` | `(effort: ReasoningEffort, maxOutputTokens: number) => number \| undefined` | Computes token budget for Anthropic thinking models. |

### 10. `src/util/cost.ts`

| Export | Type | Description & Constraints |
| :--- | :--- | :--- |
| `calculateCost` | `(model: Model, usage: TokenUsage) => TokenCost \| undefined` | Calculates exact USD cost breakdown (input, output, cache-read, cache-write, total). |

---

## Architectural Invariants

1. **Pluggable Transformer Seam:** The transformer layer (`src/transformer/`) remains strictly pure schema translation, allowing runtime model providers to be swapped with zero changes to agent orchestration.
2. **Never Throw in Streaming:** `ai.stream()` never throws synchronously; errors are delivered as `{ type: 'error' }` events, ensuring agent turn loops remain resilient.
3. **Canonical Token Usage:** Token accounting uses `noCacheTokens` to prevent cache read double-counting across turns.
4. **Offline Resilience:** All essential models and providers operate offline with fallback default provider models.
