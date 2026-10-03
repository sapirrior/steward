# SDK Contract — AI SDK v7 Verified Facts

Generated during Phase 0 by reading installed `.d.ts` at exact pinned versions.
**This file is the source of truth for all `[VERIFY-P0]` items from Appendix B of plan.md.**

Versions: `ai@7.0.127`, `@ai-sdk/anthropic@4.0.71`, `@ai-sdk/openai@4.0.83`,
`@ai-sdk/google@4.0.87`, `@ai-sdk/mistral@4.0.56`, `@ai-sdk/xai@5.0.14`,
`@ai-sdk/deepseek@3.0.58`, `@ai-sdk/openai-compatible@3.0.62`, `@ai-sdk/groq@4.0.54`

---

## 1. TextStreamPart Field Names (Appendix B item 1)

From `TextStreamPart<TOOLS>` union in `node_modules/ai/dist/index.d.ts`:

| Part type | Key fields |
| :--- | :--- |
| `text-start` | `id: string`, `providerMetadata?: ProviderMetadata` |
| `text-delta` | `id: string`, `text: string`, `providerMetadata?` ← **field is `text`** (SDK transforms from provider `delta`) |
| `text-end` | `id: string`, `providerMetadata?` |
| `reasoning-start` | `id: string`, `providerMetadata?` |
| `reasoning-delta` | `id: string`, `text: string`, `providerMetadata?` ← **field is `text`** |
| `reasoning-end` | `id: string`, `providerMetadata?` |
| `tool-input-start` | `id: string`, `toolName: string`, `providerMetadata?`, `providerExecuted?`, `dynamic?`, `title?` |
| `tool-input-delta` | `id: string`, `delta: string`, `providerMetadata?` |
| `tool-input-end` | `id: string`, `providerMetadata?` |
| `tool-call` | `type: 'tool-call'` + `TypedToolCall<TOOLS>` (has `toolCallId`, `toolName`, `args`) |
| `tool-result` | `type: 'tool-result'` + `TypedToolResult<TOOLS>` |
| `tool-error` | `type: 'tool-error'` + `TypedToolError<TOOLS>` |
| `finish-step` | `response`, `usage: LanguageModelUsage`, `performance`, `finishReason: FinishReason`, `rawFinishReason: string \| undefined`, `providerMetadata: ProviderMetadata \| undefined` |
| `finish` | `finishReason: FinishReason`, `rawFinishReason: string \| undefined`, `totalUsage: LanguageModelUsage` |
| `abort` | `reason?: string` |
| `error` | `error: unknown` |
| `raw` | `rawValue: unknown` |
| `source`, `file`, `reasoning-file`, `custom` | ignored per plan |

**IMPORTANT:** Text delta field is `text` (NOT `delta`). Reasoning delta field is also `text`.
Tool input delta field is `delta`. Tool call id field is `toolCallId` (NOT `id`).

---

## 2. Usage Shape (Appendix B item 2)

```typescript
type LanguageModelUsage = {
  inputTokens: number | undefined;          // TOTAL input (includes cached)
  inputTokenDetails: {
    noCacheTokens: number | undefined;      // ← uncached input (Steward canonical "input")
    cacheReadTokens: number | undefined;    // ← cache read
    cacheWriteTokens: number | undefined;   // ← cache write
  };
  outputTokens: number | undefined;         // total output (includes reasoning)
  outputTokenDetails: {
    textTokens: number | undefined;
    reasoningTokens: number | undefined;    // ← reasoning token count
  };
  totalTokens: number | undefined;
};
```

**Usage derivation for Steward canonical `TokenUsage`:**
- `input` = `inputTokenDetails.noCacheTokens ?? inputTokens` (prefer no-cache field)
- `cacheRead` = `inputTokenDetails.cacheReadTokens`
- `cacheWrite` = `inputTokenDetails.cacheWriteTokens`
- `reasoning` = `outputTokenDetails.reasoningTokens`
- `output` = `outputTokens`
- `total` = `totalTokens`

This resolves D-G (double-counting). Use `finish-step` part's `usage`, not `totalUsage` from `finish`
(finish has all-steps total; for single-step calls they're equal, but use finish-step to be explicit).

---

## 3. Tool / jsonSchema (Appendix B item 3)

- `jsonSchema` is exported from `'ai'` — use it to wrap raw JSON Schema objects.
- `tool({ inputSchema, description })` (no `execute`) ends the SDK loop after one step.
- SDK does NOT validate tool inputs by default when no `execute` is provided.
- Step limit: use `stopWhen: stepCountIs(1)` (`isStepCount` aliased as `stepCountIs` in exports).

---

## 4. stopWhen / Step Control (Appendix B item 4)

- `stopWhen` option on `streamText` accepts a `StopCondition`.
- `stepCountIs` is exported as `stepCountIs` from `'ai'` (internally `isStepCount`).
- Usage: `stopWhen: stepCountIs(1)` for single-step.

---

## 5. streamText Option Names (Appendix B item 5)

```typescript
streamText({
  model,                         // LanguageModel
  instructions,                  // system prompt (preferred over messages with system role)
  messages,                      // ModelMessage[]
  tools,                         // ToolSet (no execute = single step)
  stopWhen: stepCountIs(1),      // force single step
  maxOutputTokens,               // max output tokens (name confirmed)
  reasoning,                     // ReasoningLevel (portable across providers)
  providerOptions,               // per-provider options (e.g. { anthropic: {...} })
  headers,                       // Record<string, string>
  abortSignal,                   // AbortSignal
  maxRetries: 0,                 // disable SDK retries (Steward owns retry loop)
  onChunk,                       // optional callback per chunk
})
```

- `allowSystemInMessages` default is `false` in v7 — DO NOT use system messages in `messages[]`.
- `instructions` is the correct field for system prompt content.

---

## 6. Provider Factory Options (Appendix B item 6)

All providers accept: `apiKey`, `baseURL`, `headers`, `fetch` (confirmed from `.d.ts`).

| Provider | Factory function | Namespace key |
| :--- | :--- | :--- |
| Anthropic | `createAnthropic({ apiKey, baseURL, headers, fetch })` | `'anthropic'` |
| OpenAI | `createOpenAI({ apiKey, baseURL, headers, fetch })` | `'openai'` |
| Google | `createGoogleGenerativeAI({ apiKey, baseURL, headers, fetch })` | `'google'` |
| Mistral | `createMistral({ apiKey, baseURL, headers, fetch })` | `'mistral'` |
| xAI | `createXai({ apiKey, baseURL, headers, fetch })` | `'xai'` |
| DeepSeek | `createDeepSeek({ apiKey, baseURL, headers, fetch })` | `'deepseek'` |
| Groq | `createGroq({ apiKey, baseURL, headers, fetch })` | `'groq'` |
| OpenAI-compatible | `createOpenAICompatible({ name, baseURL, apiKey, headers, fetch })` | `name` value |

**xAI note:** `@ai-sdk/xai@5.x` has NO `chat()` method — only Responses API via `xai(modelId)`.
This supersedes plan.md decision D10. xAI uses Responses API (the only available option).

**OpenAI-compatible namespace:** The `name` option value becomes the providerMetadata namespace key.

---

## 7. Provider Metadata Keys (Appendix B item 7)

Needs Phase 7 live smoke for full confirmation. Known from docs:
- Anthropic: `providerMetadata.anthropic.cacheControl`, thinking signature in reasoning parts
- OpenAI: `providerMetadata.openai.itemId`, `reasoningEncryptedContent`
- Google: thought signatures in reasoning parts

**[PARTIALLY VERIFIED]** — exact field paths confirmed via Phase 7 smoke.

---

## 8. Anthropic Header / Reasoning (Appendix B item 8)

- Top-level `reasoning` option accepted by `@ai-sdk/anthropic` without extra beta headers.
- Adaptive vs budget: SDK handles based on model capability.
- `cacheControl` option shape: set via `providerOptions.anthropic.cacheControl` per message.

**[PARTIALLY VERIFIED]** — confirm interleaved thinking header need in Phase 7.

---

## 9. Error Classes (Appendix B item 9)

```typescript
// From ai/dist/index.d.ts:
class APICallError extends AISDKError        // HTTP errors: statusCode, responseBody, responseHeaders, isRetryable, url
class StreamProviderError extends AISDKError // Stream errors: type?, code?, statusCode?, isRetryable, data
class NoSuchToolError extends AISDKError     // Tool not found
class JSONParseError extends AISDKError      // JSON parse failure
class TypeValidationError extends AISDKError // Schema validation failure
// No dedicated class found for "tool input error" — surfaces as TypeValidationError
```

**Note:** `APICallError` does NOT have `responseBody` directly on the class — check `cause` or
parse from constructor. Verify exact field in Phase 5 implementation.

---

## 10. Mock Language Model Helper (Appendix B item 10)

`MockLanguageModelV4` (NOT `MockLanguageModelV1`) available from `'ai/test'`.
Import as: `import { MockLanguageModelV4 } from 'ai/test';`

The mock's `doStream` must return `LanguageModelV4StreamResult` with provider-level chunks:
- `text-delta` uses `delta` field (provider level)
- Requires `{ type: 'stream-start', warnings: [] }` as the first chunk
- `finish` uses `usage: { inputTokens, outputTokens, totalTokens }` (simplified shape)

`fullStream` (TextStreamPart level) then exposes `text` field on text-delta/reasoning-delta parts.

---

## 11. DeepSeek env var / Ollama endpoint / models.dev keys (Appendix B item 11)

- DeepSeek env var: `DEEPSEEK_API_KEY` (confirmed from `@ai-sdk/deepseek` factory)
- Ollama default endpoint: `http://localhost:11434/v1` (standard Ollama OpenAI-compatible endpoint)
- models.dev provider keys: **[REQUIRES live api.json fixture]** — capture in Phase 2

---

## 12. Default Model IDs (Appendix B item 12)

**[DEFERRED to Phase 2]** — verify against live models.dev before updating `DEFAULT_PROVIDER_MODELS`.

---

## 13. OpenAI Responses reasoning event (Appendix B item 13)

Moot after migration — legacy adapter removed in Phase 9.

---

## 14. Bun build compatibility (Appendix B item 14)

Installed successfully with Bun, `bun test packages/ai` passes (149/149) with new deps.
Build target compatibility: verify with `bun run build` in Phase 3.
