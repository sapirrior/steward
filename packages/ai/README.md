# Package Name (`@steward/ai`)

Unified multi-provider streaming AI inference engine, wire protocol transformer, and model orchestrator for Steward.

---

## 1. Overview & Architecture

### High-Level Mental Model
`@steward/ai` is the central model inference core of Steward. It decouples high-level agent turn runners and terminal user interfaces from the concrete mechanics of underlying LLM wire protocols. Powered by the AI SDK v7 engine and a pure transformer architecture, `@steward/ai` provides:

- **11 Built-in Providers:** First-class support for OpenAI, Anthropic, Google Gemini, DeepSeek, Groq, Mistral, xAI Grok, OpenRouter, Ollama (Local), GitHub Copilot, and Custom (OpenAI-compatible) endpoints.
- **Unified Streaming Contract:** Standardized `InferenceStream` yielding incremental text deltas, reasoning/thinking blocks, tool invocation deltas, and retry telemetry.
- **Pure Transformer Seam:** Functional, bi-directional normalization of message histories, tool schemas, token usage metrics, and error classifications without side effects.
- **Non-Throwing Streaming Guarantee:** `ai.stream()` never throws synchronously, and `stream.result()` never rejects; all failures surface as structured `error` stream events.
- **Resilient Retry & Backoff:** Configurable retry engine with exponential/polynomial backoff, jitter, per-attempt timeouts, and `Retry-After` header parsing.
- **Accurate Cost & Token Accounting:** Precise token resolution distinguishing uncached input (`noCacheTokens`) from cached reads, with exact USD cost evaluation per model.

### Architecture & Data Flow (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             @steward/ai Pipeline                            │
└─────────────────────────────────────────────────────────────────────────────┘

 Caller / Agent Loop (e.g., runAgentLoop)
       │
       ├─── ai.stream(InferenceRequest: { model, messages, tools, effort, ... })
       │
       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  1. Auth & Model Resolution (resolveApiKey)                                │
 │     Priority: Request Override ──► Options ──► Callback ──► Env ──► Keyless│
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  2. Transformer Layer (src/transformer/)                                   │
 │     ├─ normalizeMessages()   ──► ModelMessage[] + system instructions      │
 │     ├─ normalizeTools()      ──► AI SDK ToolSet via jsonSchema()           │
 │     └─ normalizeOptions()    ──► reasoning effort, temperature, headers    │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  3. Provider Dispatch (Provider.languageModel)                             │
 │     AI SDK streamText() invocation (OpenAI, Anthropic, Gemini, Copilot, …) │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  4. Stream Pump (pumpSdkStream)                                            │
 │     Consumes streamText.fullStream:                                        │
 │     ├─ 'text-delta'       ──► stream.push({ type: 'text-delta' })          │
 │     ├─ 'reasoning-delta'  ──► stream.push({ type: 'reasoning-delta' })     │
 │     ├─ 'tool-input-*'     ──► stream.push({ type: 'tool-call-start/delta'})│
 │     ├─ 'tool-call'        ──► stream.push({ type: 'tool-call-end' })       │
 │     ├─ 'finish-step'      ──► capture step finishReason & usage            │
 │     ├─ 'finish'           ──► normalizeUsage(totalUsage) & calculateCost() │
 │     └─ 'error'            ──► normalizeError(err)                          │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  5. AssistantMessageStream (FIFO Queue & Accumulator)                      │
 │     ├─ AsyncIterable<InferenceEvent> (UI/Agent consumption)                │
 │     └─ .result() Promise (resolves once with complete InferenceResult)     │
 └────────────────────────────────────────────────────────────────────────────┘
```

### Key Technical Invariants

1. **Never Throw / Never Reject Contract:** `ai.stream()` never throws synchronously, and `stream.result()` never rejects. Stream-level failures (auth, network, rate limits, parsing) are emitted as terminal `{ type: 'error', error: AIError }` events, and `result()` resolves with `{ finishReason: 'error' | 'aborted', error: AIError, message }`.
2. **Deterministic Terminal Event:** Exactly one terminal event (`done` or `error`) is emitted per stream. Once a terminal event is pushed, no subsequent events are emitted.
3. **No Double-Counting for Cache Reads:** Token usage normalization uses `noCacheTokens` when provided by the model backend to report true uncached prompt input, preventing cached tokens from being billed twice in usage calculations.
4. **Adaptive Temperature with Reasoning:** For models where reasoning/extended thinking is active (e.g. Anthropic Claude 3.7 Sonnet), temperature is automatically omitted from request parameters to comply with upstream provider API requirements.
5. **Decoupled Auth Resolution:** The authentication resolver (`src/auth.ts`) contains zero filesystem I/O and zero OAuth logic; it resolves keys in strict priority order (`request` $\to$ `option` $\to$ `callback` $\to$ `env` $\to$ `keyless`).

---

## 2. Quick Start & Basic Usage

```typescript
import { createAI } from '@steward/ai';

// 1. Initialize AI instance with standard environment key detection
const ai = createAI();

// 2. Stream an inference request
const stream = ai.stream({
  model: {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-5',
    effort: 'medium',
  },
  messages: [
    { role: 'user', content: 'Explain Raft consensus protocol in three sentences.' },
  ],
});

// 3. Iterate over streaming events in real time
for await (const event of stream) {
  switch (event.type) {
    case 'reasoning-delta':
      process.stdout.write(`\x1b[90m${event.delta}\x1b[0m`);
      break;
    case 'text-delta':
      process.stdout.write(event.delta);
      break;
    case 'retry':
      console.warn(`\n[Retry ${event.attempt}/${event.maxAttempts}] Waiting ${event.delayMs}ms: ${event.error.message}`);
      break;
  }
}

// 4. Retrieve canonical completion result and token metrics
const result = await stream.result();
console.log(`\n\nFinish Reason: ${result.finishReason}`);
console.log(`Total Tokens: ${result.usage.total} (Input: ${result.usage.input}, Output: ${result.usage.output})`);
if (result.usage.cost) {
  console.log(`Total Cost: $${result.usage.cost.total.toFixed(6)} USD`);
}
```

---

## 3. Core Concepts & Mental Model

### Supported Providers & Protocols

| Provider ID | Implementation Package | Default Model | Auth Env Var(s) | Reasoning Support |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic` | `@ai-sdk/anthropic` | `claude-sonnet-4-5` | `ANTHROPIC_API_KEY` | Native (Thinking budget & signatures) |
| `openai` | `@ai-sdk/openai` | `gpt-4o` | `OPENAI_API_KEY` | Native (`o1`, `o3-mini`, `gpt-4o`) |
| `google` | `@ai-sdk/google` | `gemini-2.5-flash` | `GEMINI_API_KEY`, `GOOGLE_API_KEY` | Native (Thinking config) |
| `deepseek` | `@ai-sdk/deepseek` | `deepseek-chat` | `DEEPSEEK_API_KEY` | Native (`deepseek-reasoner`) |
| `groq` | `@ai-sdk/groq` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` | Native (DeepSeek R1 on Groq) |
| `mistral` | `@ai-sdk/mistral` | `mistral-large-latest` | `MISTRAL_API_KEY` | Native |
| `grok` | `@ai-sdk/xai` | `grok-3` | `XAI_API_KEY` | Native |
| `openrouter` | `@ai-sdk/openai-compatible` | `anthropic/claude-sonnet-4-5`| `OPENROUTER_API_KEY` | Gateway pass-through |
| `ollama` | `@ai-sdk/openai-compatible` | `llama3.2` | Keyless / local (`localhost:11434`)| Local models |
| `github-copilot`| `@ai-sdk/openai-compatible`| `gpt-4o` | `GITHUB_TOKEN`, `COPILOT_API_KEY` | Model-dependent |
| `custom` | `@ai-sdk/openai-compatible` | `custom` | `CUSTOM_API_KEY` (Keyless by default)| Self-hosted LLM endpoints |

### Authentication Resolution Order
When an inference is dispatched, `resolveApiKey()` evaluates authentication sources in strict order:
1. **Request Override:** `request.apiKey` (e.g. from session-specific credential).
2. **Explicit Options:** `opts.apiKeys[provider.id]` provided during `createAI()`.
3. **Dynamic Callback:** `opts.getApiKey(provider.id)` (e.g. dynamic token store or OAuth manager).
4. **Environment Variables:** Evaluated against `provider.envVars` (e.g. `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
5. **Keyless Provider:** If `provider.keyless === true` (e.g. `ollama` or local servers), proceeds without credentials.
6. **Failure:** If unresolvable, throws `AIError({ code: 'auth' })`.

### Stream Lifecycle & Accumulation
The `AssistantMessageStream` maintains an internal FIFO queue and content accumulator:
- **Incremental Parsing:** Accumulates partial text chunks, reasoning thought traces, and tool arguments in real time.
- **Partial Preservation:** If a generation is aborted or fails halfway through, `.result()` retains whatever partial text or tool calls were emitted prior to termination.
- **Automatic Cost Calculation:** Evaluates token pricing against `model.cost` on stream completion.

### Error Taxonomy & Context Overflow Detection
`AIError` categorizes errors with a standard `code`:
- `'auth'`: Missing, invalid, or expired API credentials (HTTP 401/403).
- `'network'`: Socket drops, DNS resolution errors, connection timeouts.
- `'rate-limit'`: HTTP 429 rate limit exceeded.
- `'context-overflow'`: Request exceeded model's maximum context length.
- `'invalid-request'`: Malformed parameters or schema errors (HTTP 400/404/422).
- `'provider'`: Upstream server errors (HTTP 500, 502, 503, 504, 529).
- `'parse'`: Response JSON structure or schema validation failure.
- `'aborted'`: Execution interrupted via `AbortSignal`.

---

## 4. API & Contract Reference

### Primary Types (`src/types.ts`)

#### `ReasoningEffort`
```typescript
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
```

#### `ToolSpec`
Schema describing tools available for model invocation.
```typescript
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
```

#### `InferenceRequest`
```typescript
export interface InferenceRequest {
  model: Model | ModelSelection | ModelRef;
  messages: readonly Message[];
  tools?: readonly ToolSpec[];
  effort?: ReasoningEffort;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  headers?: Record<string, string>;
  abortSignal?: AbortSignal;
}
```

#### `InferenceEvent`
Events emitted during stream iteration:
```typescript
export type InferenceEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call-start'; id: string; name: string }
  | { type: 'tool-call-delta'; id: string; delta: string }
  | { type: 'tool-call-end'; toolCall: ToolCallContent }
  | { type: 'retry'; attempt: number; maxAttempts: number; delayMs: number; error: AIError }
  | { type: 'done'; message: AssistantMessage; usage: TokenUsage; finishReason: FinishReason }
  | { type: 'error'; error: AIError; partial?: AssistantMessage };
```

#### `InferenceResult`
```typescript
export interface InferenceResult {
  message: AssistantMessage;
  usage: TokenUsage;
  finishReason: FinishReason;
  error?: AIError;
}
```

#### `TokenUsage` & `TokenCost`
```typescript
export interface TokenCost {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  reasoning?: number;
  total?: number;
  cost?: TokenCost;
}
```

---

## 5. Functions & Utilities Reference

### Core Runtime Factory (`src/client.ts`)

#### `createAI(opts?: CreateAIOptions): AI`
Creates the AI client registry and execution runtime.

```typescript
export interface AI {
  providers(): readonly Provider[];
  provider(id: ProviderId): Provider | undefined;
  registerProvider(p: Provider): void;
  unregisterProvider(id: ProviderId): void;

  models(filter?: ProviderId): readonly Model[];
  model(providerId: ProviderId, modelId: string): Model | undefined;
  registerModel(model: Model): void;

  availableModels(filter?: ProviderId): Promise<readonly Model[]>;
  isConfigured(providerId: ProviderId): Promise<boolean>;
  authStatus(providerId: ProviderId): Promise<ProviderAuthStatus>;
  resolveModel(request?: { provider?: ProviderId; modelId?: string; effort?: ReasoningEffort }): Promise<ModelSelection>;

  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<InferenceResult>;
}
```

### Authentication Resolver (`src/auth.ts`)

#### `resolveApiKey(provider: Provider, options?: AuthOptions, requestApiKey?: string): Promise<ResolvedAuth>`
Resolves credentials in priority order without disk I/O.

### Utilities (`src/util/`)

| Utility Function | Module | Description |
| :--- | :--- | :--- |
| `withRetry(request, options)` | `src/util/retry.ts` | Wraps async requests with exponential backoff, jitter, per-attempt timeout, and `Retry-After` header adherence. |
| `calculateCost(model, usage)` | `src/util/cost.ts` | Calculates USD pricing breakdown from per-million token rates. |
| `parseJson(text)` | `src/util/json.ts` | Strict JSON parser throwing structured `AIError('parse')`. |
| `parseStreamingJson(partial)` | `src/util/json.ts` | Tolerant partial JSON repair utility for streaming tool inputs. |
| `sanitizeSurrogates(text)` | `src/util/sanitize.ts` | Removes unpaired UTF-16 surrogates to prevent tokenizer/JSON crashes. |
| `readErrorBody(response)` | `src/util/error-body.ts` | Reads, truncates (max 4k chars), and redacts secrets from HTTP error bodies. |
| `isContextOverflow(result, limit)`| `src/util/overflow.ts` | Detects explicit, silent, and length-stop context overflow conditions. |
| `normalizeProviderId(name)` | `src/index.ts` | Normalizes aliases (e.g. `'gemini'` $\to$ `'google'`, `'xai'` $\to$ `'grok'`). |

---

## 6. Advanced Patterns & Practical Guides

### Tool Calling with Dynamic Streaming
```typescript
const stream = ai.stream({
  model: { provider: 'openai', modelId: 'gpt-4o', effort: 'none' },
  messages: [{ role: 'user', content: 'Search the codebase for parseModelRef' }],
  tools: [
    {
      name: 'grep',
      description: 'Search file contents using regular expressions',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          path: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
  ],
});

for await (const event of stream) {
  if (event.type === 'tool-call-end') {
    console.log(`Tool Requested: ${event.toolCall.name}`);
    console.log(`Arguments:`, event.toolCall.arguments);
  }
}
```

### Registering Custom OpenAI-Compatible Endpoints
```typescript
import { createAI, openAICompatibleProvider } from '@steward/ai';

const localVllm = openAICompatibleProvider({
  id: 'vllm-local',
  name: 'vLLM Local Server',
  baseUrl: 'http://localhost:8000/v1',
  defaultModelId: 'mistralai/Mistral-7B-Instruct-v0.3',
  keyless: true,
});

const ai = createAI({ providers: [localVllm] });
const stream = ai.stream({
  model: { provider: 'vllm-local', modelId: 'mistralai/Mistral-7B-Instruct-v0.3', effort: 'none' },
  messages: [{ role: 'user', content: 'Hello local model!' }],
});
```

---

## 7. Real-World Gotchas, Tips & Edge Cases

1. **Anthropic Extended Thinking Temperature Invariant:**
   The Anthropic API strictly rejects requests containing explicit `temperature` when `thinking` / reasoning is enabled. `normalizeOptions` automatically strips the temperature parameter when reasoning is active.
2. **Double-Counting Cache Reads:**
   Some providers include cached tokens in `inputTokens`. The usage transformer explicitly looks for `inputTokenDetails.noCacheTokens` first to ensure only true uncached prompt tokens are counted as input.
3. **Silent Context Window Overflow:**
   Certain providers (e.g. z.ai or some OpenAI-compatible proxies) return HTTP 200 with `finish_reason: "stop"` even when prompt length exceeds the model window. `isContextOverflow` checks if `inputTokens + cacheReadTokens > contextWindow` and converts the outcome to `finishReason: 'error'`.
4. **Unpaired Unicode Surrogates:**
   Extracting file slices or git diffs can occasionally produce orphaned high/low surrogate pairs. `sanitizeSurrogates` purges these before JSON serialization to avoid breaking remote tokenizers.

---

## 8. Directory & Module Map

```
packages/ai/
├── src/
│   ├── index.ts                 # Package entrypoint & public API re-exports
│   ├── types.ts                 # Domain contracts (Message, Model, InferenceEvent, TokenUsage)
│   ├── errors.ts                # AIError taxonomy & HTTP status classification
│   ├── auth.ts                  # Pure API key resolution pipeline
│   ├── client.ts                # createAI factory, provider registry & inference dispatch
│   ├── event-stream.ts          # AssistantMessageStream FIFO queue & content accumulator
│   ├── provider/                # Provider implementations
│   │   ├── index.ts             # Built-in provider registry (11 providers)
│   │   ├── definitions.ts       # Shared provider types
│   │   ├── anthropic.ts         # Anthropic provider (@ai-sdk/anthropic)
│   │   ├── openai.ts            # OpenAI provider (@ai-sdk/openai)
│   │   ├── google.ts            # Google Gemini provider (@ai-sdk/google)
│   │   ├── deepseek.ts          # DeepSeek provider (@ai-sdk/deepseek)
│   │   ├── groq.ts              # Groq provider (@ai-sdk/groq)
│   │   ├── mistral.ts           # Mistral provider (@ai-sdk/mistral)
│   │   ├── grok.ts              # xAI Grok provider (@ai-sdk/xai)
│   │   ├── openrouter.ts        # OpenRouter gateway provider
│   │   ├── ollama.ts            # Ollama local inference provider
│   │   ├── github-copilot.ts    # GitHub Copilot provider with proxy-ep resolution
│   │   ├── custom.ts            # Custom OpenAI-compatible environment provider
│   │   └── compatible.ts        # openAICompatibleProvider factory
│   ├── transformer/             # Pure bidirectional schema translation layer
│   │   ├── index.ts             # Transformer module exports
│   │   ├── messages.ts          # Message & reasoning history normalization
│   │   ├── message-builder.ts   # Incremental AssistantMessage builder
│   │   ├── tools.ts             # ToolSet schema normalization
│   │   ├── options.ts           # Reasoning effort & option normalization
│   │   ├── usage.ts             # Token usage & finish reason normalization
│   │   ├── errors.ts            # SDK error normalization
│   │   ├── stream.ts            # pumpSdkStream fullStream event pump
│   │   └── config.ts            # Namespace configuration
│   └── util/
│       ├── retry.ts             # Request retry, backoff, jitter, and timeouts
│       ├── cost.ts              # USD cost calculation
│       ├── json.ts              # Strict & tolerant partial JSON parsing
│       ├── sanitize.ts          # Unicode surrogate sanitization
│       ├── error-body.ts        # HTTP error body extraction & secret redaction
│       └── overflow.ts          # Context overflow detection
├── tests/                       # Colocated unit & integration test suites
├── package.json                 # Workspace package definition (@steward/ai)
├── tsconfig.json                # TypeScript configuration
└── README.md                    # Authoritative READMEDOC documentation manual
```

---

## 9. Verification & Testing

Run the test suite across all providers and utilities via Bun:

```bash
# Execute full AI test suite
bun test ./packages/ai/tests
```
