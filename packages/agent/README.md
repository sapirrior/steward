# @steward/agent

The `@steward/agent` package provides the agent loop, tool definition and execution, chat modes and policy, skill discovery, lifecycle hooks runtime, and core session and infrastructure services for Steward using `@steward/ai`.

---

## File & Function Breakdown

### Engine Modules (`src/engine/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agent-session.ts` | `AgentSession` | Class | Manages in-memory agent lifecycle, model selection, reasoning effort, turn execution, and lifecycle hook orchestration. | Injected with `@steward/ai` `createAI()` instance and `HookRuntime`. |
| `turn-context.ts` | `prepareTurn` | Function | Prepares execution environment, checkpoint tracker, and event logging for a turn. | Builds canonical `Message` and plain `ToolSpec` array. |
| `agent-runner.ts` | `runAgentTurn` | Function | Executes multi-step agent turn, dispatching tools sequentially, invoking lifecycle callbacks (`beforeToolUse`, `afterToolUse`, `toolUseFailure`, `agentStop`), and emitting lifecycle events. | Pure loop over `@steward/ai` stream with callback seams. |
| `system-prompt.ts` | `buildSystemPrompt` / `buildSystemPromptSections` / `diffSystemPromptSections` | Function | Assembles dynamic, modular system instructions, sections, and diff patches including workspace context, mode policy, and skills. | Injects mode rules and deduplicated guidelines. |
| `events.ts` | `AgentEvent` | Type | Discriminated union of streaming events (`text-delta`, `reasoning-delta`, `tool-call`, `tool-result`, `step-end`, `turn-complete`, `error`). | Typed event contract for UI rendering. |

---

### Tools (`src/tools/`)

Every tool has an implementation file in `src/tools/` and a corresponding schema definition registered in `ToolCatalog`.

| File | Tool Name | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `catalog.ts` | `ToolCatalog` / `defaultToolCatalog` | Central tool registry converting Zod schemas to JSON schema `ToolSpec` and dispatching execution. | Validates access permissions before execution. |
| `read-file/` | `read_file` | Reads the full content of a workspace file with line numbers. | Bounded path resolution; returns line count and content. |
| `write-file/` | `write_file` | Creates a new file or completely overwrites an existing file. | Requires user permission for new files or destructive overwrites; records CAS checkpoint pre-image. |
| `edit-file/` | `edit_file` | Performs exact string replacements in an existing file. | Requires user permission; shows diff preview; records CAS checkpoint pre-image. |
| `list-dir/` | `list_dir` | Lists directory contents with file types and sizes. | Depth-bounded directory exploration. |
| `glob/` | `glob` | Finds files matching glob patterns (`**/*.ts`). | Fast file discovery respecting workspace boundaries. |
| `grep/` | `grep` | Regular expression text search across workspace files. | Bounded regex search with line numbers. |
| `sleep/` | `sleep` | Pauses execution for a specified number of seconds. | Safe async timer pause. |
| `bash/` | `bash` | Runs a shell command securely in the workspace. | Gated by user permission; outputs stdout/stderr. |
| `task-read/` | `task_read` | Reads recent output from a running background shell task. | Tail buffer retrieval from `TaskManager`. |
| `task-send-input/` | `task_send_input` | Sends stdin input text to an active background task. | Pipes input directly to running child process. |
| `task-kill/` | `task_kill` | Terminates a background task by ID. | Graceful SIGTERM with SIGKILL fallback. |
| `web-fetch/` | `web_fetch` | Fetches webpage content and converts HTML to markdown. | Strips scripts and stylesheets; SSRF protection. |
| `web-search/` | `web_search` | Performs web search via DuckDuckGo HTML. | Parses titles, snippets, and URLs (max 10 results). |
| `skill-list/` | `SkillList` | Lists available on-demand skills from `.agents/skills/`. | Discovers project and user skills. |
| `skill-read/` | `SkillRead` | Reads the `SKILL.md` instructions for a specific skill. | Loads on-demand skill documentation into context. |

---

### Policy & Modes (`src/policy/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `modes.ts` | `CHAT_MODES` / `MODES` | Constant | Supported chat modes (`normal`, `chat`, `review`, `build`). | Configures prompt persona and tool availability. |
| | `getActiveMode` / `setActiveMode` | Function | Gets or sets the canonical active chat mode state. | Single source of truth for runtime tool filtering. |
| | `cycleMode` | Function | Cycles to the next available chat mode (`normal -> chat -> review -> build`). | Invoked by keyboard shortcut `Ctrl+B`. |
| | `listModes` / `findMode` | Function | Lists metadata for all modes or searches mode by query. | Used by `/mode` slash command palette. |
| | `isAllowed` | Function | Evaluates if a tool access level is permitted in the given mode. | Enforces tool permission boundaries. |

---

### Lifecycle Hooks Runtime (`src/hooks/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `runtime.ts` | `HookRuntime` | Class | Executes lifecycle hooks sequentially across events (`SessionStart`, `UserPromptSubmit`, `BeforeToolUse`, `AfterToolUse`, `ToolUseFailure`, `AgentStop`). | Handles process spawns, timeouts, matchers, and aggregation. |
| `config.ts` | `loadHooksConfig` / `compileHooksConfig` | Function | Discovers and compiles `.steward/hooks.json` (project) and `~/.steward/hooks.json` (user). | Validates schema and pre-compiles regex matchers. |
| `matcher.ts` | `compileMatcher` / `matchesEvent` | Function | Compiles glob / pipe pattern matchers (`bash\|write_file`, `*`) against hook trigger events. | Pre-compiled regex matching. |
| `types.ts` | `HookEvent` / `HookResult` | Type | Type definitions for hook declarations, triggers, and execution outputs. | Ephemeral context protocol. |

---

### Services Subsystems (`src/services/`)

| File / Subsystem | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `session/store.ts` | `listSessions` / `loadSession` / `saveSession` | Function | Manages Session Schema v1 persistence in `~/.steward/sessions/`. | Validates schema with Zod; supports atomic JSON writes. |
| `session/logs/store.ts` | `SessionLogWriter` / `loadSessionLog` | Class / Fn | Writes and loads structured JSONL presentation logs (`~/.steward/session-logs/<date>/<id>.jsonl`). | Appends streaming presentation events per turn. |
| `checkpoint/cas.ts` | `ContentAddressedStore` | Class | Content-addressed storage for file pre-images and content hashes. | SHA-256 keyed blob storage in `~/.steward/checkpoints/cas/`. |
| `checkpoint/rewind.ts` | `executeRewind` | Function | Performs atomic workspace rollback to previous turns. | Restores pre-images and truncates session turns atomically. |
| `tasks/manager.ts` | `TaskManager` | Class | Manages background shell tasks, streaming tail buffers, and process lifecycle. | Bounded ring buffer for task output streaming. |
| `config/settings.ts` | `loadSettings` / `saveSettings` | Function | Reads and writes user preferences in `~/.steward/settings.json`. | Stores default model, theme, effort, and mode. |
| `config/trust.ts` | `isFolderTrusted` / `trustFolder` | Function | Manages trusted workspace folder list in `~/.steward/trusted-folders.json`. | Prevents arbitrary hook execution in untrusted paths. |
| `logging/error-logger.ts` | `logError` / `classifyError` | Function | Classifies runtime errors and appends structured error logs to `~/.steward/errors.jsonl`. | Categorizes errors into system, permission, model, and network. |

---

## Agent Invariants & Safety

1. **Pure Agent Loop**: Completely decoupled from provider implementations via `@steward/ai`.
2. **Permission Gating**: Destructive mutations (`write_file`, `edit_file`, `bash`) require explicit human-in-the-loop permission callback approval before modifying the workspace.
3. **Sequential Tool Execution**: Multiple tool calls in a turn execute sequentially in model order to prevent permission and checkpoint races.
4. **Checkpoint Integration**: `write_file` and `edit_file` automatically record pre-mutation CAS hashes to enable lossless rewind.
5. **Lifecycle Hook Seams**: Ephemeral hook context (`SessionStart`, `UserPromptSubmit`, `AfterToolUse`, `ToolUseFailure`) attaches to system instructions without corrupting session message transcripts.
6. **Bounded Turn Continuations**: Natural finish events checked by `AgentStop` hooks allow at most one retry continuation per turn.
