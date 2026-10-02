# @steward/agent

The `@steward/agent` package provides the agent loop, tool catalog and execution, chat modes and policy, skill discovery, and core session, CAS checkpoint, rewind, background tasks, and settings services for Steward. It owns its own ports (`ports/model.ts`) and has zero dependencies on `@steward/ai` or any sibling packages.

---

## File & Function Breakdown

### Ports (`src/ports/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `model.ts` | `ModelPort` | Interface | Canonical port interface that the agent runner and session depend on to stream model responses. | Implemented structurally by CLI runtime; agent never imports `@steward/ai`. |
| `model.ts` | `PortStream` / `PortResult` / `PortEvent` / `PortError` | Interface / Type | Async stream, result, error, and event contracts surfaced through `ModelPort`. | Structured error and event contracts. |
| `model.ts` | `Message` / `ToolSpec` / `JsonSchema` / `TokenUsage` / `ModelSelection` | Interface / Type | Pure message and model configuration types owned by agent. | Matches session schema and tool contracts. |

---

### Engine Modules (`src/engine/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agent-session.ts` | `AgentSession` | Class | Manages in-memory agent lifecycle, model selection, reasoning effort, turn execution, and session persistence. | Injected with `ModelPort` (`deps: { ai: ModelPort }`). |
| `turn-context.ts` | `prepareTurn` | Function | Prepares execution environment, checkpoint tracker, and event logging for a turn. | Builds canonical `Message` and plain `ToolSpec` array. |
| `agent-runner.ts` | `runAgentTurn` | Function | Executes deterministic multi-step agent turn loop, dispatching tool calls, consuming stream events and `PortResult` without uncaught exceptions, and accumulating canonical token usage. | Pure multi-step loop over `ModelPort.stream` with callback seams. |
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

### Services Subsystems (`src/services/`)

| File / Subsystem | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `session/schema.ts` | `SessionDocument` / `SessionTurn` / `SESSION_SCHEMA_VERSION` | Types / Schema | Defines Session Document schema v1 with canonical `TokenUsage` (`input`, `output`, `total`, `reasoning`, `cacheRead`, `cacheWrite`) and backwards compatibility for legacy fields. | Immutable `schemaVersion: 1`. |
| `session/store.ts` | `listSessions` / `loadSession` / `saveSession` / `createSession` | Function | Manages Session persistence in `~/.steward/sessions/`. | Validates schema with Zod; supports atomic JSON writes and quarantine on invalid documents. |
| `session/logs/store.ts` | `SessionLogWriter` / `loadSessionLog` | Class / Fn | Writes and loads structured JSONL presentation scrollback logs (`~/.steward/session-logs/<date>/<id>.jsonl`). | Appends streaming presentation events per turn. |
| `checkpoint/cas.ts` | `ContentAddressedStore` | Class | Content-addressed storage for file pre-images and content hashes. | SHA-256 keyed blob storage in `~/.steward/checkpoints/cas/`. |
| `checkpoint/tracker.ts` | `MutationCheckpointTracker` | Class | Tracks file mutations per turn and stages checkpoint pre/post images. | Integrated directly into file mutation tools. |
| `checkpoint/lock.ts` | `MutationLockManager` | Class | Manages deterministic fine-grained file mutation locks. | Lexicographical lock acquisition to avoid deadlocks. |
| `checkpoint/rewind.ts` | `executeRewind` | Function | Performs atomic workspace rollback and history truncation to previous turns. | Restores pre-images, recalculates usage, and truncates session turns atomically. |
| `tasks/manager.ts` | `TaskManager` | Class | Manages background shell tasks, streaming tail buffers, and process lifecycle. | Bounded ring buffer for task output streaming. |
| `config/settings.ts` | `loadSettings` / `saveSettings` | Function | Reads and writes user preferences in `~/.steward/settings.json`. | Stores default model, theme, effort, and mode. |
| `config/trust.ts` | `isFolderTrusted` / `trustFolder` | Function | Manages trusted workspace folder list in `~/.steward/trusted-folders.json`. | Restricts operations in untrusted paths. |
| `logging/error-logger.ts` | `logError` / `classifyError` | Function | Classifies runtime errors and appends structured error logs to `~/.steward/errors.jsonl`. | Categorizes errors into system, permission, model, and network. |

---

## Agent Invariants & Safety

1. **Zero Sibling Dependencies**: `@steward/agent` defines its own ports in `ports/model.ts` and never imports `@steward/ai` or any sibling package.
2. **Permission Gating**: Destructive mutations (`write_file`, `edit_file`, `bash`) require explicit human-in-the-loop permission callback approval before modifying the workspace.
3. **Sequential Tool Execution**: Multiple tool calls in a turn execute sequentially in model order to prevent permission and checkpoint races.
4. **Checkpoint Integration**: `write_file` and `edit_file` automatically record pre-mutation CAS hashes to enable lossless rewind.
5. **Schema v1 Stability**: Session document schema remains strictly at `schemaVersion: 1` with canonical `TokenUsage` formatting.
6. **Chat Modes Guarantee**: The 4 chat modes (`normal`, `chat`, `review`, `build`) and `/mode` commands remain canonical and fully functional.
