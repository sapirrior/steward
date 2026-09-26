# A sub package named plugins for Steward for deterministic lifecycle command hooks and extension points

This package provides a zero-dependency, synchronous command-hook runtime and configuration engine for Steward. It supports exactly six deterministic lifecycle events, strict JSON configuration, filtered execution environments, exact matcher sets, and result aggregation.

---

## File & Function Breakdown

### Hook Contracts & Configuration (`hooks/types.ts`, `hooks/config.ts`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `types.ts` | `HOOK_EVENT_NAMES` | Constant | The exact six v1 lifecycle events: `SessionStart`, `UserPromptSubmit`, `BeforeToolUse`, `AfterToolUse`, `ToolUseFailure`, `AgentStop`. | Frozen event taxonomy. |
| | `HookEventPayload` | Type | Discriminated union of typed payloads for each lifecycle event. | Strictly bounded JSON stdin contract. |
| | `HookResult` | Type | Machine-readable result containing optional `decision`, `reason`, and `additionalContext`. | Stdout JSON schema. |
| | `AggregateHookResult` | Type | Aggregation of sequential hook executions across sources. | Contains `blocked`, `firstBlockReason`, `context`, `errors`. |
| `config.ts` | `compileHooksConfig` | Function | Validates raw JSON configuration against strict Zod schema and returns compiled hooks. | Rejects unknown keys or invalid matchers atomically. |
| | `loadHooksConfigFile` | Function | Loads and compiles a `hooks.json` file from disk. | Returns empty hooks list on syntax or schema errors without throwing. |
| | `getUserHooksPath` | Function | Resolves `~/.steward/hooks.json` (or `STEWARD_SETTINGS_DIR`). | Isolated user-level hook location. |
| | `getProjectHooksPath` | Function | Resolves `.steward/hooks.json` relative to project directory. | Workspace-level hook location. |

---

### Matcher & Process Execution (`hooks/match.ts`, `hooks/execute.ts`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `match.ts` | `compileMatcher` | Function | Precompiles pipe-separated exact tool or lifecycle names into Set lookups or wildcard flags. | Exact match and wildcard (`*`) only; no regex. |
| | `hasHooksForEvent` | Function | Fast-path check determining whether any enabled hooks exist for an event. | Zero-allocation fast-path check. |
| | `matchesHook` | Function | Evaluates if a compiled hook matches the incoming event payload. | Exact lookup by tool name or lifecycle source. |
| `execute.ts` | `executeHook` | Function | Spawns external shell command with JSON stdin and captures stdout/stderr. | Strips provider secrets; enforces timeout and size limits. |

---

### Runtime Engine & Built-ins (`hooks/runtime.ts`, `builtins/index.ts`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `runtime.ts` | `HookRuntime` | Class | Orchestrates hook discovery, source ordering (`builtin -> user -> project -> plugin`), sequential execution, and context accumulation. | Holds ephemeral context and AgentStop continuation budget. |
| | `HookRuntime.load` | Function | Factory method loading all sources subject to workspace trust. | Disables external hooks if workspace is untrusted. |
| `builtins/index.ts` | `createConfigHealthBuiltin` | Function | Creates `HookConfigHealth` built-in hook running on `SessionStart`. | Diagnostic-only context; never blocks. |

---

## Hook Lifecycle & Invariants

1. **Deterministic Execution Order**: Hooks execute sequentially in fixed source priority: `builtin -> user -> project -> plugin`. Within a source, declaration array order is preserved.
2. **Strict Payload & Output Bounds**: Stdin is capped at 256 KiB, stdout at 32 KiB, stderr at 16 KiB, and additionalContext at 8 KiB.
3. **Secret Isolation**: Child processes receive a sanitized environment stripping provider API keys (`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.).
4. **Trust Gating**: External project/user hooks are only executed when `isFolderTrusted()` is established.
5. **Zero-Work Fast Path**: If no hooks are registered for an event, execution returns immediately without allocating JSON or child processes.
6. **Bounded AgentStop Continuation**: `AgentStop` allows at most one continuation retry per turn (`MAX_AGENT_STOP_CONTINUATIONS = 1`).
