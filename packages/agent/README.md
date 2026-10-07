# @steward/agent

The `@steward/agent` package provides the pure, deterministic multi-step agent turn loop for Steward. It has zero framework dependencies and zero dependencies on sibling packages.

---

## File & Function Breakdown

### Agent Loop (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agentLoop.ts` | `runAgentLoop` | Function | Executes deterministic multi-step agent turn loop with sequential tool execution, incomplete tool-call filtering on abort, and token accumulation. | Pure turn runner taking `StreamFn` and tool executor callback. |
| `agentLoop.ts` | `accumulateTokenUsage` | Function | Pure helper to accumulate token usage metrics safely across multiple steps. | Tracks input, output, reasoning, cacheRead, and cacheWrite. |
| `agentLoop.ts` | `sanitizeAssistantMessage` | Function | Filters out uncompleted or orphaned tool-call content blocks from an assistant message upon error or abort. | Guarantees 1:1 tool-call / tool-result pairing. |
| `events.ts` | `AgentLoopEvent` | Type | Discriminated union of turn events (`agent-start`, `turn-start`, `message-start`, `message-update`, `message-end`, `tool-execution-start`, `tool-execution-end`, `retry`, `turn-end`, `agent-end`). | Typed event contract consumed by UI/adapters. |
| `types.ts` | `Message`, `AssistantMessage`, `ToolCallContent`, `ToolResult`, `AgentRunResult`, `StreamFn` | Interface / Type | Pure message and agent run result contracts. | Zero-dependency interfaces. |

---

## Invariants & Guarantees

1. **Zero External AI SDKs:** Pure agent loop implementation without Vercel AI SDK or wrapper dependencies.
2. **Sequential Tool Execution:** Tool calls execute sequentially in model order.
3. **1:1 Tool Pairing:** Incomplete or orphaned tool calls on abort receive synthetic error results to keep message history valid.
4. **Resilient Event Dispatch:** Event listeners cannot crash the multi-step execution loop.
