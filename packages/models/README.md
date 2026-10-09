# Package Name (`@steward/models`)

Zero-dependency, high-performance async client and reference parser for `models.dev` model catalog metadata, token limits, capabilities, and pricing in Steward.

---

## 1. Overview & Architecture

### High-Level Mental Model
`@steward/models` is a lightweight, zero-dependency metadata client designed for runtime AI model introspection. It fetches, parses, normalizes, and caches provider and model metadata from [models.dev](https://models.dev) (or custom endpoints), providing instant lookups for:
- Token limits (`contextWindow`, `maxInputTokens`, `maxOutputTokens`)
- Pricing metrics (USD per 1M tokens for input, output, cache read, and cache write)
- Capability introspection (`reasoning`, `toolCall`, `inputModalities`, `outputModalities`)
- Model reference parsing and formatting (`provider/modelId` canonical representation)

The package operates purely in memory with lazy, non-blocking asynchronous fetching and automatic concurrent request deduplication.

### Architecture & Data Flow (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @steward/models Engine                           │
└─────────────────────────────────────────────────────────────────────────────┘

 Caller / Consumer (e.g., @steward/cli)
       │
       ├─── parseModelRef("openrouter/anthropic/claude-sonnet-4.5")
       │         │
       │         └───► { provider: "openrouter", modelId: "anthropic/claude-sonnet-4.5" }
       │
       └─── models.get("anthropic", "claude-3-5-sonnet-20241022")
                 │
                 ▼
       ┌────────────────────────┐
       │   ensureLoaded Cache   │ ◄─── Cache Hit ─── (Instant return)
       └──────────┬─────────────┘
                  │ Cache Miss
                  ▼
       ┌────────────────────────┐
       │ inFlightPromise Check  │ ◄─── In Flight ─── (Deduplicate & join promise)
       └──────────┬─────────────┘
                  │ No In-Flight
                  ▼
       ┌────────────────────────┐
       │  fetchAndParseModels   │ ───► HTTP GET https://models.dev/api.json
       └──────────┬─────────────┘
                  │
                  ▼
       ┌────────────────────────┐
       │  Raw JSON Normalizer   │
       │  - Lowercase Provider  │
       │  - Extract Modalities  │
       │  - Parse USD Pricing   │
       │  - Map Token Limits    │
       └──────────┬─────────────┘
                  │
                  ▼
       ┌────────────────────────────────────────────────────────┐
       │ Cache: Map<providerId, Map<modelId, ModelMetadata>>    │
       └────────────────────────────────────────────────────────┘
                  │
                  ├───► .get(provider, modelId) ──► ModelMetadata | undefined
                  └───► .list({ provider, textCapable }) ──► readonly ModelMetadata[]
```

### Key Technical Invariants

1. **Zero External Runtime Dependencies:** Pure TypeScript relying strictly on the native web standards `fetch` API.
2. **Zero Sibling Dependencies:** Self-contained within `packages/models`; never imports from sibling packages (`@steward/ai`, `@steward/agent`, `@steward/tui`, `@steward/oauth`, `@steward/cli`).
3. **Single In-Flight Deduplication:** Multiple concurrent queries coalesce into a single remote network fetch.
4. **Resilient Retry on Error:** If a network or parsing failure occurs, the in-flight promise is cleared immediately so subsequent invocations can retry.
5. **Split-on-First-Slash ModelRef Parsing:** Supports multi-slash namespaced model identifiers (e.g., OpenRouter paths like `openrouter/anthropic/claude-3-7-sonnet`) by splitting only on the first `/`.
6. **Case Policy:** Provider lookups and keys are normalized to lowercase; `modelId` strings preserve their exact casing.

---

## 2. Quick Start & Basic Usage

```typescript
import { createModels, parseModelRef, formatModelRef } from '@steward/models';

// 1. Instantiate the client
const models = createModels();

// 2. Parse model references
const ref = parseModelRef('anthropic/claude-3-5-sonnet-20241022');
if (ref) {
  console.log(`Provider: ${ref.provider}, Model: ${ref.modelId}`);
  console.log(`Formatted: ${formatModelRef(ref)}`);
}

// 3. Fetch model metadata
const metadata = await models.get('anthropic', 'claude-3-5-sonnet-20241022');
if (metadata) {
  console.log(`Model: ${metadata.name}`);
  console.log(`Context Window: ${metadata.contextWindow} tokens`);
  console.log(`Max Output: ${metadata.maxOutputTokens} tokens`);
  console.log(`Supports Reasoning: ${metadata.reasoning}`);
  console.log(`Supports Tool Calls: ${metadata.toolCall}`);
  console.log(`Input Pricing (USD/1M): $${metadata.pricing?.input}`);
  console.log(`Output Pricing (USD/1M): $${metadata.pricing?.output}`);
}

// 4. List text-capable models for a provider
const openAiModels = await models.list({
  provider: 'openai',
  textCapable: true,
});
console.log(`Found ${openAiModels.length} text-capable OpenAI models.`);
```

---

## 3. Core Concepts & Mental Model

### Model Reference Grammar (`ModelRef`)
Model specifications in Steward follow a canonical `provider/modelId` schema:
- `parseModelRef(input)` splits on the **first forward slash** (`/`). Any remaining slashes are preserved as part of the `modelId`.
- Whitespace surrounding the string or slash is stripped.
- Provider names are trimmed; `modelId` casing is preserved.
- Returns `undefined` if empty or missing a separating slash.

### Lazy Ingestion & Caching Lifecycle
1. **Lazy Loading:** Creating a client via `createModels()` does not make immediate network calls. The remote request triggers only when `.list()` or `.get()` is first called.
2. **In-Flight Coalescing:** If multiple callers invoke `.get()` or `.list()` concurrently before the metadata download completes, all calls share the exact same pending `Promise`.
3. **Cache Storage:** Metadata is organized into nested maps (`Map<string, Map<string, ModelMetadata>>`), indexed by lowercase provider name and exact `modelId`.
4. **Cache Invalidation:** Calling `models.refresh()` flushes the internal cache map and resets the in-flight state.

### Error Taxonomy (`ModelsError`)
All ingestion and retrieval failures are wrapped in a structured `ModelsError` class with a `kind` discriminator:
- `'network'`: Underlying connection failure, timeout, or DNS resolution error.
- `'http'`: Remote server returned a non-2xx HTTP status code (e.g., 404, 500); captures `status`.
- `'malformed'`: Response payload was not valid JSON or lacked the expected top-level provider dictionary structure.

---

## 4. API & Contract Reference

### `ModelPricing`
USD cost per 1 million tokens for operations.

```typescript
export interface ModelPricing {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
}
```

### `ModelMetadata`
Normalized, operational metadata for a single model.

```typescript
export interface ModelMetadata {
  provider: string;
  id: string;
  name: string;
  reasoning?: boolean;
  toolCall?: boolean;
  inputModalities: readonly string[];
  outputModalities: readonly string[];
  contextWindow?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  pricing?: ModelPricing;
}
```

### `ModelRef`
Structured provider and model identifier pair.

```typescript
export interface ModelRef {
  provider: string;
  modelId: string;
}
```

### `ListModelsOptions`
Options passed to `models.list()`.

| Option | Type | Description |
| :--- | :--- | :--- |
| `provider` | `string \| undefined` | Optional provider name to filter results (case-insensitive). |
| `textCapable` | `boolean \| undefined` | When `true`, filters to models supporting `'text'` in both `inputModalities` and `outputModalities`. |

### `CreateModelsOptions`
Options passed to `createModels()`.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `fetch` | `typeof fetch \| undefined` | Global `fetch` | Custom `fetch` implementation for testing or custom transports. |
| `url` | `string \| undefined` | `DEFAULT_MODELS_DEV_URL` | Target models metadata endpoint URL. |

### `Models` Interface
Primary client interface.

```typescript
export interface Models {
  list(opts?: ListModelsOptions): Promise<readonly ModelMetadata[]>;
  get(provider: string, modelId: string): Promise<ModelMetadata | undefined>;
  refresh(): Promise<void>;
}
```

---

## 5. Functions & Utilities Reference

### `createModels(options?: CreateModelsOptions): Models`
Instantiates an in-memory cached model client.
- **Parameters:** Optional configuration specifying custom `fetch` or endpoint `url`.
- **Returns:** An object implementing the `Models` interface.

### `parseModelRef(input: string): ModelRef | undefined`
Parses a `provider/modelId` string into a structured `ModelRef`.
- **Parameters:** Raw string input.
- **Returns:** `{ provider, modelId }` or `undefined` if invalid.
- **Rules:**
  - Splits only on the first `/`.
  - Trims surrounding whitespace from both components.
  - Preserves exact character casing of `modelId`.

### `formatModelRef(ref: ModelRef): string`
Formats a `ModelRef` into a canonical `provider/modelId` string.
- **Parameters:** `ref: ModelRef`
- **Returns:** `${ref.provider}/${ref.modelId}`

### `fetchAndParseModels(fetchFn?: typeof fetch, url?: string): Promise<Map<string, Map<string, ModelMetadata>>>`
Performs HTTP fetch and data normalization against the models endpoint.
- **Parameters:**
  - `fetchFn`: Fetch function (defaults to native `fetch`).
  - `url`: API endpoint URL (defaults to `DEFAULT_MODELS_DEV_URL`).
- **Returns:** A two-level Map keyed by `[lowercaseProvider][modelId]`.
- **Throws:** `ModelsError` on network, HTTP, or JSON formatting failures.

### `DEFAULT_MODELS_DEV_URL: string`
Constant holding the default endpoint URL (`https://models.dev/api.json`).

---

## 6. Advanced Patterns & Practical Guides

### Custom Endpoint & Mock Transport
When running in air-gapped environments or unit test suites, pass custom fetch handlers:

```typescript
import { createModels } from '@steward/models';

const mockFetch: typeof fetch = async () => {
  return new Response(JSON.stringify({
    custom_provider: {
      id: 'custom_provider',
      name: 'Custom Provider',
      models: {
        'my-local-llm': {
          id: 'my-local-llm',
          name: 'My Local LLM',
          modalities: { input: ['text'], output: ['text'] },
          limit: { context: 32768, output: 4096 }
        }
      }
    }
  }), { status: 200 });
};

const models = createModels({ fetch: mockFetch });
const model = await models.get('custom_provider', 'my-local-llm');
```

### Filtering Models for Conversational Text Agents
Ensure non-text models (such as image-only or embedding models like DALL-E) are excluded from chat pickers:

```typescript
const chatCapableModels = await models.list({
  provider: 'openai',
  textCapable: true,
});
```

---

## 7. Real-World Gotchas, Tips & Edge Cases

1. **Multi-Slash OpenRouter Model IDs:**
   OpenRouter model IDs often contain slashes representing their upstream vendor (e.g. `openrouter/anthropic/claude-3.7-sonnet`). `parseModelRef` strictly splits on the **first** slash, ensuring:
   - `provider`: `"openrouter"`
   - `modelId`: `"anthropic/claude-3.7-sonnet"`
2. **Provider Key Normalization vs Model ID Case Sensitivity:**
   Provider keys are always normalized to lower case during lookups (e.g. searching `"ANTHROPIC"` resolves to `"anthropic"`). However, `modelId` keys preserve exact case to match upstream provider APIs.
3. **Error Retries After Network Drops:**
   When an initial fetch fails (e.g., DNS timeout), the internal `inFlightPromise` is cleared immediately in the `.catch()` block. Subsequent calls will automatically initiate a fresh HTTP request rather than caching the rejected promise.
4. **Malformed Provider / Model Entry Resilience:**
   If a single model or provider entry in the remote JSON response is null or malformed, `fetchAndParseModels` skips that individual entry and continues processing valid entries.

---

## 8. Directory & Module Map

```
packages/models/
├── src/
│   ├── index.ts        # Package root exports (types, ref, source, client)
│   ├── types.ts        # Type contracts, ModelMetadata, ModelPricing, ModelsError
│   ├── ref.ts          # parseModelRef, formatModelRef utilities
│   ├── source.ts       # fetchAndParseModels, DEFAULT_MODELS_DEV_URL, normalizer
│   ├── client.ts       # createModels client factory, in-memory caching & deduplication
│   └── models.test.ts  # Test suite verifying parsing, caching, deduplication & errors
├── package.json        # Workspace package definition (@steward/models)
├── tsconfig.json       # TypeScript configuration
└── README.md           # Authoritative READMEDOC documentation manual
```

---

## 9. Verification & Testing

Run tests and type checking directly via Bun:

```bash
# Run unit tests
bun test ./packages/models/src

# Run TypeScript type check
bun run --cwd packages/models typecheck
```
