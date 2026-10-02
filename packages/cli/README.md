# @steward/cli

The `@steward/cli` package serves as the application composition root and terminal user interface for Steward, orchestrating `@steward/ai`, `@steward/agent`, and `stitchable` into an interactive terminal engineering assistant.

---

## File & Function Breakdown

### Entry & Core Orchestrator (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `main.ts` | CLI entry point | Script | CLI bootstrapper handling flags (`-v`, `-h`, `-r`, `--config mode`) and bootstrapping `TUIApp`. | Global unhandled rejection and exception handlers initialized before app startup. |
| `app.ts` | `TUIApp` | Class | Main application orchestrator managing component mounting, user turns, and dock state transitions. | Coordinates `TerminalEngine`, `AgentSession`, `ModalController`, and `PermissionQueue`. |
| `errors/present.ts` | `presentError` | Function | Single source of truth for CLI error presentation; translates structured errors into headlines and actionable hints without substring heuristics. | Returns `PresentedError` with headline, hint, and tone. |

---

### UI Components & Controllers (`src/ui/`)

| File / Component | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `components/Header.tsx` | Component | Sticky top banner showing Steward logo, version, working directory, and active model. | Renders at the top of history. |
| `components/PromptInput.tsx` | Component | Main interactive prompt input supporting multiline typing, cursor navigation, history, `@file` search, and `/slash` palette. | Unicode-safe and ANSI-safe text buffer. |
| `components/StreamingView.tsx` | Component | Live streaming response view rendering incremental text, thinking indicator, and active tool execution status. | Real-time ANSI-rendered markdown output. |
| `components/StatusBar.tsx` | Component | Sticky bottom bar displaying active model, reasoning effort, token usage counters, and chat mode badge. | Subline status bar. |
| `components/TrustGate.tsx` | Component | Security gate displayed when launching in an untrusted workspace folder. | Requires explicit folder authorization before accessing sensitive paths. |
| `components/docks/FilePermissionDock.tsx` | Component | Interactive modal reviewing file creations, edits, and overwrites with line diffs before applying changes. | Yes / No / Review (F) mode. |
| `components/docks/BashPermissionDock.tsx` | Component | Interactive modal prompting for approval before executing bash commands. | Yes / No selection with command preview. |
| `components/docks/ModelPicker.tsx` | Component | Interactive dock for switching LLM models across all configured providers. | Searchable provider list with capability badges. |
| `components/docks/LoginPicker.tsx` | Component | Interactive dock for authenticating with AI providers via OAuth and Device flows. | Displays connection status and provider metadata. |
| `components/docks/SessionMenu.tsx` | Component | Interactive dock for browsing, resuming, or deleting saved session transcripts. | Lists past sessions with turn counts. |
| `components/docks/RewindMenu.tsx` | Component | Interactive dock for rolling back file changes to previous session turns with diff statistics. | Computes accurate `+lines / -lines` per turn. |
| `components/docks/ShortcutsMenu.tsx` | Component | Help modal displaying all keyboard shortcuts and navigation tips. | Quick-reference keyboard cheat sheet. |
| `components/docks/EffortPicker.tsx` | Component | Interactive horizontal slider dock for adjusting reasoning effort. | Selects `none`, `low`, `medium`, or `high`. |
| `modal-controller.ts` | Class | Coordinates modal docks (Pickers, Permission Docks, Help, Menus) and focus transitions. | Centralizes modal open/close lifecycle. |
| `utils/permission-queue.ts` | Class | Serializes multiple permission requests into an asynchronous FIFO queue. | Displays one permission dock at a time. |
| `utils/transcript.ts` | Function | Rehydrates past session turns and events into terminal engine history. | Renders historical user messages, assistant responses, and tool statuses. |
| `utils/message-formatter.ts` | Function | Formats system messages, error badges, user prompts, assistant markdown, and tool execution status lines. | Tree connector prefixes and ANSI styles. |

---

### Slash Commands (`src/commands/`)

| Command | File | Description |
| :--- | :--- | :--- |
| `/help` | `commands/help/` | Opens help manual and keyboard shortcut reference. |
| `/model` | `commands/model/` | Opens interactive ModelPicker dock or switches model directly. |
| `/mode` | `commands/mode/` | Cycles through or sets active chat mode (`normal`, `chat`, `review`, `build`). |
| `/effort` | `commands/effort/` | Adjusts reasoning effort slider (`none`, `low`, `medium`, `high`). |
| `/login` | `commands/login/` | Opens interactive OAuth provider login picker dock or logs in to specified provider. |
| `/logout` | `commands/logout/` | Logs out of a specific provider or clears all credentials from `~/.steward/auth.json`. |
| `/sessions` | `commands/sessions/` | Opens SessionMenu dock to browse and switch sessions. |
| `/rewind` | `commands/rewind/` | Opens RewindMenu dock to roll back workspace mutations. |
| `/clear` | `commands/clear/` | Clears current terminal history buffer. |
| `/copy` | `commands/copy/` | Copies the last AI assistant message to the clipboard. |
| `/export` | `commands/export/` | Exports the 1:1 UI conversation transcript to the clipboard or a file. |
| `/init` | `commands/init/` | Scaffolds AGENTS.md and .agents/skills/ in the workspace. |
| `/bug` | `commands/bug/` | Displays the issue tracker and feedback URL. |
| `/usage` | `commands/usage/` | Displays token usage metrics and turn statistics for the active session. |
| `/exit` | `commands/exit/` | Gracefully cleans up terminal and exits Steward. |

---

### Utilities (`src/utils/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `bash.ts` | `executeDirectBash` | Function | Executes direct user shell commands (`!<command>`) with real-time streaming output. | Bypasses LLM turn history, checkpoints, and agent lifecycle hooks; logged to presentation journal. |
| `open-url.ts` | `openUrl` | Function | Cross-platform utility to open URLs in default web browser. | Supports Linux (`xdg-open`), macOS (`open`), Termux (`termux-open-url`), and Windows (`start`). |

---

## Application Invariants

1. **Trust Gate Ordering**: External project and user lifecycle hooks are disabled until the user explicitly approves workspace trust via the `TrustGate`.
2. **Direct Shell & Slash Command Bypass**: User direct bash executions (`!<command>`) and `/slash` commands are application-level operations and bypass agent lifecycle hooks (`UserPromptSubmit`, `BeforeToolUse`, etc.).
