# A sub package named agents for Steward for orchestrating LLM interactions, tool executions, and system loops

This package is responsible for agent loops, tool definition and execution, chat modes and policy, skill discovery, and session orchestration using `@steward/ai`.

---

## File & Function Breakdown

### Engine Modules (`engine/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agent-session.ts` | `AgentSession` | Class | Manages in-memory agent lifecycle, model selection, reasoning effort, and turn execution. | Injected with `@steward/ai` `AIEngine`. |
| `turn-context.ts` | `prepareTurn` | Function | Prepares execution environment, checkpoint tracker, and event logging for a turn. | Builds canonical `Message` and plain `ToolSpec` array. |
| `agent-runner.ts` | `runAgentTurn` | Function | Executes multi-step agent turn, dispatching tools sequentially and emitting lifecycle events. | Pure loop over `@steward/ai` stream. |
| `system-prompt.ts` | `buildSystemPrompt` | Function | Assembles dynamic system instructions including workspace context, active mode policy, and available skills. | Injects mode rules and skill manifests. |
| `events.ts` | `AgentEvent` | Type | Discriminated union of streaming events (`text-delta`, `reasoning-delta`, `tool-call`, `tool-result`, `step-end`, `turn-complete`, `error`). | Typed event contract for UI rendering. |

---

### Tools (`tools/` Sub-directory)

Every tool has an implementation file in `tools/` and a corresponding schema definition registered in `ToolCatalog`.

| File | Tool Name | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `catalog.ts` | `ToolCatalog` | Central tool registry converting Zod schemas to JSON schema `ToolSpec` and dispatching execution. | Validates access permissions before execution. |
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

### Policy & Modes (`policy/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `modes.ts` | `CHAT_MODES` | Constant | Supported chat modes (`normal`, `chat`, `review`, `build`). | Configures prompt persona and tool availability. |
| | `getModePrompt` | Function | Returns specialized system prompt instructions for active mode. | Guides model behavior per mode. |

---

## Agent Invariants & Safety

1. **Pure Agent Loop**: Completely decoupled from provider implementations via `@steward/ai`.
2. **Permission Gating**: Destructive mutations (`write_file`, `edit_file`, `bash`) require explicit human-in-the-loop permission callback approval before modifying the workspace.
3. **Sequential Tool Execution**: Multiple tool calls in a turn execute sequentially in model order to prevent permission and checkpoint races.
4. **Checkpoint Integration**: `write_file` and `edit_file` automatically record pre-mutation CAS hashes to enable lossless rewind.
