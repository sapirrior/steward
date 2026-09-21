# A sub package named agents for Steward for orchestrating LLM interactions, tool executions, and system loops

This package is responsible for model provider resolution, streaming agent loops (Vercel AI SDK v7), tool definition and execution, chat modes and policy, skill discovery, and model discovery.

---

## File & Function Breakdown

### Engine Modules (`engine/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agent-session.ts` | `AgentSession` | Class | Manages in-memory agent lifecycle, model selection, reasoning effort, and turn execution. | Bridges UI commands to the runner. |
| `agent-runner.ts` | `runAgentTurn` | Function | Executes a streaming AI SDK turn using `streamText`, handling tool calls and emitting lifecycle events. | AI SDK v7 compliant; emits typed event stream. |
| `model-provider.ts` | `resolveModelProvider` | Function | Instantiates AI SDK language model instances across 8 providers (`gemini`, `anthropic`, `openai`, `xai`, `mistral`, `deepseek`, `openrouter`, `custom`). | Configures reasoning effort and API credentials. |
| | `PROVIDER_REGISTRY` | Export | Metadata and default models for all 8 supported providers. | Declares default models and capabilities. |
| `system-prompt.ts` | `buildSystemPrompt` | Function | Assembles dynamic system instructions including workspace context, active mode policy, and available skills. | Injects mode rules and skill manifests. |
| `events.ts` | `AgentEvent` | Type | Discriminated union of streaming events (`text-delta`, `tool-call-start`, `tool-call-result`, `finish`, `error`). | Typed event contract for UI rendering. |

---

### Tools (`tools/` Sub-directory)

Every tool has an implementation file in `tools/` and a corresponding schema definition registered in `ToolCatalog`.

| File | Tool Name | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
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
| `todo-write/` | `TodoWrite` | Writes or replaces session todo list. | Persisted under `~/.steward/todos/<sessionId>/`. |
| `todo-update/` | `TodoUpdate` | Updates status of existing session todo items. | Atomic state modification. |
| `todo-read/` | `TodoRead` | Reads the current session todo items. | Retrieves active task list. |
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

1. **AI SDK v7 Compliance**: Uses `instructions`, `stopWhen`, `usage.inputTokenDetails`, and standard provider factories.
2. **Permission Gating**: Destructive mutations (`write_file`, `edit_file`, `bash`) require explicit human-in-the-loop permission callback approval before modifying the workspace.
3. **Checkpoint Integration**: `write_file` and `edit_file` automatically record pre-mutation CAS hashes to enable lossless rewind.
4. **Tool Extension Checklist**:
   - Create tool folder in `tools/<tool-name>/` with schema and implementation.
   - Register tool in `tools/catalog.ts`.
   - Update README tools table.
