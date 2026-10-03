# G1 Gate — `@steward/ai` Consumers Outside `packages/ai/`

Generated during Phase 0. This file must be consulted before removing any public export in Phase 9.

---

## Summary

Only `@steward/cli` imports `@steward/ai` at runtime. `@steward/agent` imports nothing from
`@steward/ai` directly — it owns its own `ports/model.ts` interface and is wired structurally
via `cli/src/runtime.ts`.

---

## `@steward/cli` Imports

| File | Symbol | Kind | Safe to remove? |
| :--- | :--- | :--- | :--- |
| `cli/src/app.ts` | `AI` | `type` | Only if `createRuntime` return type changes |
| `cli/src/runtime.ts` | `createAI` | value | **Core wiring** — must be preserved |
| `cli/src/runtime.ts` | `AI` | `type` | Used in structural `ModelPort = ai` assertion |
| `cli/src/commands/model/index.ts` | `normalizeProviderId` | value | Safe to keep (util) |
| `cli/src/commands/model/index.ts` | `Model` | `type` | Safe to keep |
| `cli/src/commands/model/index.ts` | `ProviderId` | `type` | Safe to keep |
| `cli/src/commands/logout/index.ts` | `normalizeProviderId` | value | Safe to keep |
| `cli/src/commands/login/index.ts` | `normalizeProviderId` | value | Safe to keep |
| `cli/src/commands/effort/index.ts` | `ReasoningEffort` | `type` | Safe to keep |
| `cli/src/commands/copy/index.ts` | `Message` | `type` | Safe to keep |
| `cli/src/ui/components/docks/ModelPicker.tsx` | `Model` | `type` | Safe to keep |
| `cli/src/ui/components/docks/EffortPicker.tsx` | `ReasoningEffort` | `type` | Safe to keep |
| `cli/src/ui/modal-controller.ts` | `Model` | `type` | Safe to keep |
| `cli/src/ui/modal-controller.ts` | `ProviderId` | `type` | Safe to keep |

---

## Wire-Level Exports — Usage Status

The following low-level exports are **not imported** by any consumer outside `packages/ai/`:

| Export | Status |
| :--- | :--- |
| `anthropicMessagesProtocol` | ✅ Unused — safe to remove in Phase 9 |
| `openAICompletionsProtocol` | ✅ Unused — safe to remove in Phase 9 |
| `openAIResponsesProtocol` | ✅ Unused — safe to remove in Phase 9 |
| `googleGenerativeAIProtocol` | ✅ Unused — safe to remove in Phase 9 |
| `decodeSSE` | ✅ Unused — safe to remove in Phase 9 |
| `withRetry` | ✅ Unused — safe to remove in Phase 9 |
| `readErrorBody` | ✅ Unused — safe to remove in Phase 9 |

---

## OAuth Integration Point

`cli/src/runtime.ts` passes `getApiKey: async (provider) => getToken(provider)` from
`@steward/oauth` into `createAI()`. This is the sole OAuth→AI bridge. The `createAI` API
signature must preserve `CreateAIOptions.getApiKey`.

---

## CLI Typecheck Command

```bash
bun run typecheck
# or targeted:
cd packages/cli && bun x tsc --noEmit
```
