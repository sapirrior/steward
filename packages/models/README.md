# @steward/models

Zero-dependency async metadata and pricing client for Steward, powered by `models.dev`.

`@steward/models` provides lightweight on-demand model discovery, capability introspection (`reasoning`, `toolCall`, `inputModalities`, `outputModalities`), token limit definitions (`contextWindow`, `maxOutputTokens`), and token pricing resolution in USD per million tokens.

---

## Package Architecture & Boundaries

- **Zero Sibling Dependencies:** `@steward/models` imports nothing from `@steward/ai`, `@steward/agent`, `@steward/cli`, or `@steward/tui`.
- **Zero Runtime Dependencies:** Pure TypeScript implementation relying exclusively on native `fetch`.
- **Sole Consumer:** `@steward/cli` imports `@steward/models` directly at composition and slash command resolution time.

---

## Module & API Breakdown

### 1. `src/types.ts`

| Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `ModelPricing` | `Interface` | USD cost per 1M tokens for input, output, cacheRead, and cacheWrite. | Converted once at ingestion from models.dev numbers. |
| `ModelMetadata` | `Interface` | Slim model descriptor containing ID, name, capabilities, token limits, and pricing. | Contains only operational fields needed by CLI/UI. |
| `ModelsError` | `Class extends Error` | Structured domain error for models retrieval failures. | Includes `kind: 'network' \| 'http' \| 'malformed'` and optional HTTP `status`. |
| `Models` | `Interface` | Interface providing `.list()`, `.get()`, and `.refresh()`. | One source of truth for runtime model metadata. |

### 2. `src/ref.ts`

| Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `parseModelRef` | `(input: string) => ModelRef \| undefined` | Parses a `provider/modelId` reference string into a structured `ModelRef`. | Splits on first `/` only; preserves modelId casing; trims whitespace. |
| `formatModelRef` | `(ref: ModelRef) => string` | Formats a structured `ModelRef` into canonical `provider/modelId` format. | Round-trips cleanly with `parseModelRef`. |
| `ModelRef` | `Interface` | Structured model reference containing `{ provider, modelId }`. | Pure data contract. |

### 3. `src/client.ts` & `src/source.ts`

| Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `createModels` | `(opts?: CreateModelsOptions) => Models` | Creates the async models client. | Deduplicates concurrent fetches to a single in-flight request; clears on failure. |
| `fetchAndParseModels` | `(fetchFn?, url?) => Promise<Map<...>>` | Fetches and ingests metadata from `https://models.dev/api.json`. | Skips malformed entries individually; converts pricing units. |
| `DEFAULT_MODELS_DEV_URL` | `Constant` | Default endpoint URL (`https://models.dev/api.json`). | Overrideable via `CreateModelsOptions`. |

---

## Architectural Invariants & Constraints

1. **Non-Blocking & Lazy:** Model metadata lookups are non-blocking and lazy; CLI startup must never block on remote models.dev queries.
2. **Offline Resilience:** If remote fetching fails, `.get()` returns `undefined` gracefully so the CLI can use default model configurations without crashing.
3. **Single In-Flight Fetch:** Concurrent calls coalesce into exactly one remote request.
