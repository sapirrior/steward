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

### UI Components (`ui/components/` Sub-directory)

| Component | Description | Key Details / Constraints |
| :--- | :--- | :--- |
| `Header.tsx` | Sticky top banner showing Steward logo, version, working directory, and model. | Renders at top of history. |
| `PromptInput.tsx` | Main interactive prompt input with typing, cursor navigation, history, `@file` search, and `/slash` command palette. | Unicode-safe and ANSI-safe text buffer. |
| `StreamingView.tsx` | Live streaming response view rendering incremental text, thinking indicator, and active tool execution status. | Real-time ANSI-rendered markdown output. |
| `StatusBar.tsx` | Sticky bottom bar displaying active model, reasoning effort, token usage counters, mode badge, and update notifications. | Subline status bar. |
| `docks/FilePermissionDock.tsx` | Interactive modal reviewing file creations, edits, and overwrites with line diffs before applying changes. | Yes / No / Review (F) mode. |
| `docks/BashPermissionDock.tsx` | Interactive modal prompting for approval before executing bash commands. | Yes / No selection with command preview. |
| `docks/ModelPicker.tsx` | Interactive dock for switching LLM models across all configured providers. | Searchable provider list with capability badges. |
| `docks/ThemePicker.tsx` | Interactive dock for live theme preview and selection. | Arrow-key navigation across color themes. |
| `docks/SessionMenu.tsx` | Interactive dock for browsing, resuming, or deleting saved session transcripts. | Lists past sessions with turn counts. |
| `docks/RewindMenu.tsx` | Interactive dock for rolling back file changes to previous session turns with diff statistics. | Computes accurate `+lines / -lines` per turn. |
| `docks/TrustGate.tsx` | Security gate displayed when launching in an untrusted workspace folder. | Requires explicit folder authorization. |

---

### Slash Commands (`commands/` Sub-directory)

| Command | File | Description |
| :--- | :--- | :--- |
| `/help` | `commands/help/` | Opens help manual and keyboard shortcut reference. |
| `/model` | `commands/model/` | Opens interactive ModelPicker dock. |
| `/mode` | `commands/mode/` | Cycles through or sets active chat mode (`normal`, `chat`, `review`, `build`). |
| `/theme` | `commands/theme/` | Opens ThemePicker dock to change visual styling. |
| `/effort` | `commands/effort/` | Adjusts reasoning effort slider (`none`, `low`, `medium`, `high`, `xhigh`). |
| `/sessions` | `commands/sessions/` | Opens SessionMenu dock to browse and switch sessions. |
| `/rewind` | `commands/rewind/` | Opens RewindMenu dock to roll back workspace mutations. |
| `/clear` | `commands/clear/` | Clears current terminal history buffer. |
| `/exit` | `commands/exit/` | Gracefully cleans up terminal and exits Steward. |
