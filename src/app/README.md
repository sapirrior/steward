# Steward Application (`src/app/`)

The application layer serves as the composition root and orchestrator for Steward, wiring together `@steward/tui`, `@steward/services`, and `@steward/agents` into an interactive terminal CLI.

---

## File & Function Breakdown

### Entry & Core Orchestrator

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `main.ts` | `run` / CLI entry | Entry | CLI bootstrapper handling flags (`-v`, `-h`, `-r`, `--config theme|mode`). | Global error handlers initialized before app startup. |
| `app.ts` | `TUIApp` | Class | Main application orchestrator managing component mounting, user turns, and dock state. | Coordinates engine, agent session, and permission queues. |

---

### UI Components & Controllers (`ui/` Sub-directory)

| File / Component | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `Header.tsx` | Component | Sticky top banner showing Steward logo, version, working directory, and model. | Renders at top of history. |
| `PromptInput.tsx` | Component | Main interactive prompt input with typing, cursor navigation, history, `@file` search, and `/slash` command palette. | Unicode-safe and ANSI-safe text buffer. |
| `prompt-input/autocomplete-controller.ts` | Class | Manages `@file` prefix path discovery and selection navigation. | Discovers files matching input token. |
| `prompt-input/command-palette-controller.ts` | Class | Manages slash command suggestion palette navigation and circular wrap selection. | Traps arrow keys to cycle options while open. |
| `prompt-input/history-controller.ts` | Class | Manages prompt history navigation stack and working draft caching. | Up/Down navigation across prompt history. |
| `modal-controller.ts` | Class | Coordinates modal docks (Pickers, Permission Docks, Help, Menus) and focus transitions. | Centralizes modal open/close lifecycle. |
| `agent-event-router.ts` | Class | Dispatches streaming agent events (`text-delta`, `tool-call`, `error`) to UI views. | Routes streaming updates to components. |
| `StreamingView.tsx` | Component | Live streaming response view rendering incremental text, thinking indicator, and active tool execution status. | Real-time ANSI-rendered markdown output. |
| `StatusBar.tsx` | Component | Sticky bottom bar displaying active model, reasoning effort, token usage counters, mode badge, and update notifications. | Subline status bar. |
| `docks/FilePermissionDock.tsx` | Component | Interactive modal reviewing file creations, edits, and overwrites with line diffs before applying changes. | Yes / No / Review (F) mode. |
| `docks/BashPermissionDock.tsx` | Component | Interactive modal prompting for approval before executing bash commands. | Yes / No selection with command preview. |
| `docks/ModelPicker.tsx` | Component | Interactive dock for switching LLM models across all configured providers. | Searchable provider list with capability badges. |
| `docks/ThemePicker.tsx` | Component | Interactive dock for live theme preview and selection. | Arrow-key navigation across color themes. |
| `docks/SessionMenu.tsx` | Component | Interactive dock for browsing, resuming, or deleting saved session transcripts. | Lists past sessions with turn counts. |
| `docks/RewindMenu.tsx` | Component | Interactive dock for rolling back file changes to previous session turns with diff statistics. | Computes accurate `+lines / -lines` per turn. |
| `docks/TrustGate.tsx` | Component | Security gate displayed when launching in an untrusted workspace folder. | Requires explicit folder authorization. |
| `docks/LoginDock.tsx` | Component | Interactive modal dock for OAuth / Device Code provider authentication. | Displays verification codes, URLs, and real-time auth status. |

---

### Slash Commands & Handlers (`commands/` Sub-directory)

| File / Command | Export / Item | Description |
| :--- | :--- | :--- |
| `handle-command-result.ts` | `handleCommandResult` | Dispatches command execution outcomes (modal triggers, mode switches, clear, errors) to UI. |
| `/help` | `commands/help/` | Opens help manual and keyboard shortcut reference. |
| `/login` | `commands/login/` | Authenticates with cloud providers (Anthropic, OpenRouter, GitHub Copilot) via browser OAuth or Device Code flow. |
| `/logout` | `commands/logout/` | Logs out from authenticated providers and revokes stored credentials. |
| `/model` | `commands/model/` | Opens interactive ModelPicker dock. |
| `/mode` | `commands/mode/` | Cycles through or sets active chat mode (`normal`, `chat`, `review`, `build`). |
| `/theme` | `commands/theme/` | Opens ThemePicker dock to change visual styling. |
| `/effort` | `commands/effort/` | Adjusts reasoning effort slider (`none`, `low`, `medium`, `high`). |
| `/sessions` | `commands/sessions/` | Opens SessionMenu dock to browse and switch sessions. |
| `/rewind` | `commands/rewind/` | Opens RewindMenu dock to roll back workspace mutations. |
| `/clear` | `commands/clear/` | Clears current terminal history buffer. |
| `/copy` | `commands/copy/` | Copies the last AI assistant message to the clipboard. |
| `/exit` | `commands/exit/` | Gracefully cleans up terminal and exits Steward. |

---

### Utilities (`utils/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `bash.ts` | `executeDirectBash` | Function | Executes direct user shell commands (`!<command>`) with real-time streaming output. | Bypasses LLM turn history, checkpoints, and agent lifecycle hooks; logged to presentation journal. |
| `open-url.ts` | `openUrl` | Function | Cross-platform utility to open URLs in default web browser. | Supports Linux (xdg-open), macOS (open), Termux (termux-open-url), and Windows (start). |

---

## Application Invariants

1. **Trust Gate Ordering**: External project and user lifecycle hooks are disabled until the user explicitly approves workspace trust via the `TrustGate`.
2. **Direct Shell & Slash Command Bypass**: User direct bash executions (`!<command>`) and `/slash` commands are application-level operations and bypass agent lifecycle hooks (`UserPromptSubmit`, `BeforeToolUse`, etc.).

