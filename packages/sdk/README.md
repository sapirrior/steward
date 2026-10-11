# `@steward/sdk`

**Frontend-neutral, streaming agent engine for Steward built on Vercel AI SDK.**

---

## 1. Overview & Architecture

### High-Level Mental Model
`@steward/sdk` is a lightweight execution core for agentic inference and tool calling. It extracts model resolution, turn streaming, error normalization, and credential-isolated provider factories into an independent library that can be consumed by CLI, TUI, desktop, or web frontends.

### Architecture & Data Flow

```
+-------------------------------------------------------------------------+
|                              Host / CLI                                 |
| (Keys & OAuth, Host Tools & Approvals, Prompt Composition, Persistence) |
+-------------------------------------------------------------------------+
                                     |
                                     | SDKRunInput {
                                     |   model: "provider/model_id",
                                     |   instructions?: string,
                                     |   messages: readonly ModelMessage[], // prior history
                                     |   message: UserModelMessage['content'], // current turn
                                     |   tools?: ToolSet,
                                     |   keyMetadata?: ProviderKeyMetadata
                                     | }
                                     v
+-------------------------------------------------------------------------+
|                              @steward/sdk                               |
|                                                                         |
|  1. parseModelIdentifier (first-slash rule)                             |
|  2. ProviderRegistry -> ProviderAdapter.createModel(modelId, metadata)  |
|  3. messageCopy & Normalization:                                        |
|     - Deep-clones prior history & current prompt content                |
|     - Normalizes tool-calls (input/args) & tool-results (output/result) |
|     - Wraps current prompt into a single role: 'user' ModelMessage      |
|  4. Vercel AI SDK streamText({ model, instructions, messages, tools })  |
|  5. Event mapper -> normalized AsyncIterable<SDKEvent>                  |
+-------------------------------------------------------------------------+
                                     |
                                     | Yields SDKEvent stream:
                                     |   text-delta | reasoning-delta |
                                     |   tool-call | tool-result |
                                     |   step-start | step-finish |
                                     |   retry | aborted | error |
                                     v
                           [ Exactly One Terminal Event ]
                           - finish (with responseMessages & usage)
                           - aborted
                           - error
```

### Key Technical Invariants
1. **Zero Monorepo Dependencies:** `@steward/sdk` does not import any `@steward/*` package.
2. **Zero Implicit Credentials:** Never reads `process.env`, `localStorage`, or token files. All credentials must be explicitly provided per-request in `keyMetadata`.
3. **Explicit Turn Boundaries:**
   - `messages`: strictly prior conversation turns (`readonly ModelMessage[]`), never containing the new prompt.
   - `message`: the new prompt's content (`UserModelMessage['content']`), converted by SDK into a single `{ role: 'user', content }` message.
4. **Transparent Message Normalization:** Automatically bridges differences between storage schemas and AI SDK Core schemas:
   - Assistant `tool-call`: bridges `args` <-> `input`.
   - Tool `tool-result`: converts raw values and legacy `result` into `ToolResultOutput` (`{ type: 'text' | 'json', value }`).
5. **Strict Immutability:** Input conversation histories and prompt payloads are copied; callers' objects are never mutated.
6. **First-Slash Model Parsing:** Splits model strings strictly on the first `/`, supporting nested IDs like `openrouter/openrouter/free`.
7. **Single Terminal Event:** Every stream terminates with exactly one of `finish`, `aborted`, or `error`.
8. **Seven-Category Error Taxonomy:** `auth`, `rate-limit`, `context-length`, `network`, `provider`, `abort`, `invalid-input` (with automatic `provider` fallback for unclassified errors).

---

## 2. Quick Start & Multi-Turn Usage

```typescript
import { createStewardSDK } from '@steward/sdk';
import type { ModelMessage } from '@steward/sdk';

const sdk = createStewardSDK();
const history: ModelMessage[] = [];

// Turn 1
for await (const event of sdk.stream({
  model: 'anthropic/claude-sonnet-4-5',
  instructions: 'You are a concise engineering assistant.',
  messages: history, // empty for first turn
  message: 'What is 2 + 2?',
  keyMetadata: { apiKey: 'sk-ant-...' },
})) {
  if (event.type === 'finish') {
    // Record turn to history
    history.push({ role: 'user', content: 'What is 2 + 2?' });
    history.push(...event.responseMessages);
  }
}

// Turn 2: seamlessly continues with prior history
for await (const event of sdk.stream({
  model: 'anthropic/claude-sonnet-4-5',
  instructions: 'You are a concise engineering assistant.',
  messages: history, // contains turn 1 user + assistant messages
  message: 'Multiply that by 10.',
  keyMetadata: { apiKey: 'sk-ant-...' },
})) {
  if (event.type === 'text-delta') {
    process.stdout.write(event.text);
  }
}
```

---

## 3. Supported Providers (11 Built-in Adapters)

| Provider ID | AI SDK Driver | Aliases | Required Metadata | Default Base URL |
| :--- | :--- | :--- | :--- | :--- |
| `anthropic` | `@ai-sdk/anthropic` | — | `apiKey` | Provider default |
| `openai` | `@ai-sdk/openai` | — | `apiKey` | Provider default |
| `google` | `@ai-sdk/google` | `gemini` | `apiKey` | Provider default |
| `openrouter` | `@ai-sdk/openai-compatible` | — | `apiKey` | `https://openrouter.ai/api/v1` |
| `github-copilot` | `@ai-sdk/openai-compatible` | `copilot` | `apiKey` | `https://api.githubcopilot.com` |
| `deepseek` | `@ai-sdk/deepseek` | — | `apiKey` | Provider default |
| `mistral` | `@ai-sdk/mistral` | — | `apiKey` | Provider default |
| `groq` | `@ai-sdk/groq` | — | `apiKey` | Provider default |
| `xai` | `@ai-sdk/xai` | — | `apiKey` | Provider default |
| `ollama` | `@ai-sdk/openai-compatible` | — | optional | `http://localhost:11434/v1` |
| `custom` | `@ai-sdk/openai-compatible` | — | `baseURL` | User-specified |

---

## 4. API Reference

### `createStewardSDK(options?: SDKOptions): StewardSDK`
Creates a reusable SDK instance.

### `sdk.stream(input: SDKRunInput): AsyncIterable<SDKEvent>`
Initiates a single streamed turn with tools and error recovery.

```typescript
export interface SDKRunInput {
  model: string;
  instructions?: string;
  messages: readonly ModelMessage[];
  message: UserModelMessage['content'];
  tools?: ToolSet;
  reasoning?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  providerOptions?: ProviderOptions;
  signal?: AbortSignal;
  maxSteps?: number;
  maxRetries?: number;
  keyMetadata?: Readonly<ProviderKeyMetadata>;
}
```

---

## 5. Directory & Module Map

```
packages/sdk/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                     # Public entrypoint
    ├── constants.ts                 # Defaults & thresholds
    ├── types.ts                     # Public interfaces & taxonomies
    ├── errors.ts                    # StewardSDKError & normalizer
    ├── errors.test.ts               # Error taxonomy unit tests
    ├── modelId.ts                   # First-slash model ID parser
    ├── modelId.test.ts              # Model parser tests
    ├── engine/
    │   ├── sdk.ts                   # Core streamText runtime
    │   └── sdk.test.ts              # Mock stream engine tests
    ├── events/
    │   ├── events.ts                # SDKEvent union definitions
    │   └── mapper.ts                # TextStreamPart to SDKEvent mapping
    ├── messages/
    │   ├── messageCopy.ts           # Deep cloning & tool schema normalization
    │   └── messageCopy.test.ts      # Immutability unit tests
    └── providers/
        ├── types.ts                 # ProviderAdapter interface
        ├── defaults.ts              # 11 built-in adapter factories
        ├── registry.ts              # Provider registry & alias mapping
        └── registry.test.ts         # Registry unit tests
```

---

## 6. Verification & Testing

```bash
# Run unit tests
bun test packages/sdk/src

# Run full monorepo suite
bun test
```
