# @steward/cli

The `@steward/cli` package serves as the executable entrypoint, command-line interface, application composition root, and terminal user interface for Steward. It orchestrates `@steward/ai`, `@steward/agent`, `@steward/oauth`, and `stitchable` into an interactive terminal engineering assistant.

---

## Table of Contents

- [Package Architecture & Boundaries](#package-architecture--boundaries)
- [Module & API Breakdown](#module--api-breakdown)
  - [1. Entry & CLI Executable Layer (`src/`, `src/cli/`)](#1-entry--cli-executable-layer-src-srccli)
  - [2. Application Composition & Orchestration (`src/app/`)](#2-application-composition--orchestration-srcapp)
  - [3. Interface Components & Controllers (`src/interface/`)](#3-interface-components--controllers-srcinterface)
  - [4. In-Session Slash Commands (`src/slash/`)](#4-in-session-slash-commands-srcslash)
  - [5. Utilities (`src/utils/`)](#5-utilities-srcutils)
  - [6. Theme System (`src/theme/`)](#6-theme-system-srctheme)
  - [7. Settings System (`src/settings/`)](#7-settings-system-srcsettings)
- [Application Invariants & Architecture Rules](#application-invariants--architecture-rules)

---

## Package Architecture & Boundaries

`@steward/cli` is structured into strictly isolated internal layers with explicit unidirectional dependencies:

```
main.ts ──▶ cli/ ──▶ app/ ──▶ interface/ ──▶ slash/
                      │            │
                      └───────────▶ slash/ ──▶ settings/
Leaf libraries (independent): settings/, theme/, errors/, utils/
```

| Layer (`src/...`) | Responsibility | Allowed Imports | Disallowed Imports |
| :--- | :--- | :--- | :--- |
| `main.ts` | Shebang, global error handlers, calls `run()`. | `cli`, `@steward/agent` | everything else |
| `cli/` | Executable/argv layer, subcommands, metadata. | `app` (launch only), `settings`, `@steward/agent` | `interface`, `slash`, `theme` |
| `app/` | Composition root, runtime creation, TUI orchestration. | `interface`, `slash`, `settings`, `theme`, `utils`, `errors` | `cli` |
| `interface/` | TUI presentation, components, docks, layout formatting. | `slash` (palette/results), `settings`, `theme`, `errors`, `utils` | `app`, `cli` |
| `slash/` | In-session `/slash` commands and registry. | `settings`, `utils`, `@steward/*`, `import type` only from `interface` | `app`, `cli`, `theme`, runtime `interface` |
| `settings/`, `theme/`, `errors/`, `utils/` | Reusable leaf modules. | external packages only | internal caller layers |

---

## Module & API Breakdown

### 1. Entry & CLI Executable Layer (`src/`, `src/cli/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/main.ts` | Entry script | Script | Thin CLI entry bootstrapper initializing global handlers and delegating to `run()`. | Un-awaited execution; no business or orchestration logic. |
| `src/cli/types.ts` | `CliCommand` | Interface | Contract for top-level CLI subcommands (`name`, `summary`, `usage`, `run`). | Subcommand architecture without flag aliases. |
| `src/cli/types.ts` | `CliCommandRegistry` | Interface | Registry contract for registering and resolving CLI subcommands. | Exact, case-sensitive command token lookup. |
| `src/cli/types.ts` | `CliIO`, `CliContext`, `CliExitCode` | Types / Interfaces | Abstract IO interface and context passed to subcommand executions. | Enables clean in-process unit testing without process globals. |
| `src/cli/meta.ts` | `VERSION`, `REPO_URL` | Constants | Package version resolved from `package.json` and canonical GitHub repository URL. | Single source of truth for CLI metadata. |
| `src/cli/registry.ts` | `DefaultCliCommandRegistry` | Class | Map-backed implementation of `CliCommandRegistry`. | Rejects duplicate command names on registration. |
| `src/cli/run.ts` | `run` | `(argv?, opts?) => Promise<void>` | CLI entry point function resolving arguments, executing commands, or launching the TUI. | Supports dependency injection (`io`, `exit`, `launch`, `registry`). |
| `src/cli/commands/version/` | `versionCommand` | `CliCommand` | Subcommand printing version string (`steward <version>`). | Canonical `steward version` subcommand. |
| `src/cli/commands/help/` | `helpCommand`, `formatHelp` | `CliCommand` / Fn | Subcommand displaying usage and available CLI commands. | Dynamic formatting padded to 33 characters. |
| `src/cli/commands/repo/` | `repoCommand` | `CliCommand` | Subcommand printing repository URL. | Canonical `steward repo` subcommand. |
| `src/cli/commands/config/` | `configCommand`, `configTargets` | `CliCommand` / List | Subcommand displaying and configuring persistent CLI settings. | Extensible targets (`mode`); returns exit code 1 on errors. |

---

### 2. Application Composition & Orchestration (`src/app/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/app/launch.ts` | `launchInteractive` | `(opts: { version: string }) => Promise<void>` | Bootstraps auth, creates runtime, loads saved model/session, and starts `TUIApp`. | Handles initialization exceptions and logs via `logError`. |
| `src/app/runtime.ts` | `createRuntime` | Function | Single runtime composition root constructing AI client with OAuth and validating `ModelPort`. | Returns `{ ai, modelPort }`. |
| `src/app/tui-app.ts` | `TUIApp` | Class | Main application orchestrator managing component mounting, user turns, and dock state transitions. | Accepts `options.io?: TerminalIO` for testing with `memoryIO`; exposes `engine`. |

---

### 3. Interface Components & Controllers (`src/interface/`)

| File / Component | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `slash-result-handler.ts` | `handleSlashCommandResult`, `applyCommandResult` | Functions | Dispatches and applies UI state side-effects from slash command results. | Mutates history, modals, or triggers session resumes. |
| `components/Header.tsx` | `Header` | Component | Sticky top banner showing Steward logo, version, working directory, and active model. | Renders at the top of history. |
| `components/PromptInput.tsx` | `PromptInput` | Component | Main interactive prompt input supporting multiline typing, cursor navigation, history, `@file` search, and `/slash` palette. | Unicode-safe, ANSI-safe buffer; consumes native `InputEvent` dispatch from `stitchable`. |
| `components/StreamingView.tsx` | `StreamingView` | Component | Live streaming response view rendering incremental text, thinking indicator, and tool status. | Real-time ANSI-rendered markdown output. |
| `components/StatusBar.tsx` | `StatusBar` | Component | Sticky bottom bar displaying active model, reasoning effort, token usage counters, and chat mode badge. | Subline status bar. |
| `components/TrustGate.tsx` | `TrustGate` | Component | Security gate displayed when launching in an untrusted workspace folder. | Requires explicit folder authorization before accessing sensitive paths. |
| `components/docks/FilePermissionDock.tsx` | `FilePermissionDock` | Component | Interactive modal reviewing file creations, edits, and overwrites with line diffs. | Yes / No / Review (F) mode. |
| `components/docks/BashPermissionDock.tsx` | `BashPermissionDock` | Component | Interactive modal prompting for approval before executing bash commands. | Yes / No selection with command preview. |
| `components/docks/ModelPicker.tsx` | `ModelPicker` | Component | Interactive dock for switching LLM models across configured providers. | Searchable provider list with capability badges. |
| `components/docks/LoginPicker.tsx` | `LoginPicker` | Component | Interactive dock for authenticating with AI providers via OAuth and Device flows. | Retains UI during device and browser OAuth authentication. |
| `components/docks/SessionMenu.tsx` | `SessionMenu` | Component | Interactive dock for browsing, resuming, or deleting saved session transcripts. | Opened via `/resume` command. |
| `components/docks/RewindMenu.tsx` | `RewindMenu` | Component | Interactive dock for rolling back file changes to previous session turns with diff statistics. | Computes accurate `+lines / -lines` per turn. |
| `components/docks/ShortcutsMenu.tsx` | `ShortcutsMenu` | Component | Help modal displaying all keyboard shortcuts and navigation tips. | Opened via `?` in prompt input. |
| `components/docks/EffortPicker.tsx` | `EffortPicker` | Component | Interactive horizontal slider dock for adjusting reasoning effort. | Selects `none`, `low`, `medium`, `high`, or `xhigh`. |
| `agent-event-router.ts` | `createAgentEventHandler` | Function | Translates AgentSession events to UI stream updates, commits, and thinking transitions. | Coordinates multi-tool completion and model reasoning states. |
| `modal-controller.ts` | `ModalController` | Class | Coordinates modal docks and focus transitions. | Centralizes modal open/close lifecycle. |
| `utils/permission-queue.ts` | `PermissionQueue` | Class | Serializes multiple permission requests into an asynchronous FIFO queue. | Displays one permission dock at a time. |
| `utils/choice.ts` | `handleChoiceKey`, `renderChoiceOption` | Function | Keyboard selection logic and option rendering for binary and fixed-choice approval gates. | Discards bracketed paste; handles arrows, numbers, enter, escape. |
| `utils/select-list.ts` | `SelectList` | Component | Keyboard-driven filterable item picker dock. | Accepts multiline pasted queries safely; handles wraparound navigation. |
| `utils/modal-box.ts` | `renderModalBox` | Function | Line-based modal enclosure renderer with title, subtitle, divider, and content. | Injected render width support; computes box layout. |
| `utils/transcript.ts` | `renderTranscript` | Function | Rehydrates past session turns and events into terminal engine history. | Renders historical user messages, responses, and tool statuses. |
| `utils/message-formatter.ts` | `formatSystemMessage`, `formatAssistantMessage` | Function | Formats system messages, error badges, user prompts, markdown, and tool status lines. | Tree connector prefixes and ANSI styles. |
| `errors/present.ts` | `presentError` | Function | Single source of truth for CLI error presentation; translates structured errors into headlines and hints. | Returns `PresentedError` with headline, hint, and tone. |

---

### 4. In-Session Slash Commands (`src/slash/`)

| Command | Implementation Directory | Description |
| :--- | :--- | :--- |
| `/bug` | `slash/bug/` | Displays the issue tracker and feedback URL. |
| `/init` | `slash/init/` | Scaffolds AGENTS.md and .agents/skills/ in the workspace. |
| `/copy` | `slash/copy/` | Copies the last AI assistant message to the clipboard. |
| `/export` | `slash/export/` | Exports the conversation transcript to the clipboard or a file. |
| `/usage` | `slash/usage/` | Displays token usage metrics and turn statistics for the active session. |
| `/rewind` | `slash/rewind/` | Opens RewindMenu dock to roll back workspace mutations. |
| `/model` | `slash/model/` | Opens interactive ModelPicker dock or switches model directly. |
| `/effort` | `slash/effort/` | Adjusts reasoning effort slider (`none`, `low`, `medium`, `high`, `xhigh`). |
| `/mode` | `slash/mode/` | Cycles through or sets active chat mode (`normal`, `chat`, `review`, `build`). |
| `/login` | `slash/login/` | Opens interactive OAuth provider login picker dock or logs in to specified provider. |
| `/logout` | `slash/logout/` | Logs out of a specific provider or clears all credentials. |
| `/clear` | `slash/clear/` | Clears current terminal history buffer. |
| `/exit` | `slash/exit/` | Gracefully cleans up terminal and exits Steward. |
| `/quit` | `slash/exit/` | Gracefully cleans up terminal and exits Steward (alias of `/exit`). |
| `/resume` | `slash/resume/` | Opens SessionMenu dock to browse sessions or resumes session by ID. |
| `/rename` | `slash/rename/` | Renames the current session. |
| `/skills` | `slash/skills/` | Lists discovered workspace and user skills. |

---

### 5. Utilities (`src/utils/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `bash.ts` | `executeDirectBash` | Function | Executes direct user shell commands (`!<command>`) with real-time streaming output. | Bypasses LLM turn history and agent lifecycle hooks. |
| `open-url.ts` | `openUrl` | Function | Cross-platform utility to open URLs in default web browser. | Supports Linux (`xdg-open`), macOS (`open`), Termux, and Windows (`start`). |

---

### 6. Theme System (`src/theme/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `colors.ts` | `darkTheme`, `UITheme`, `SyntaxTheme` | Constant / Types | Canonical dark theme palette and semantic token definitions. | Pure data structure with zero runtime side-effects. |
| `figures.ts` | `figures`, `LOGO_LINES` | Constants | Terminal Unicode glyphs, ASCII fallback symbols, and logo art. | Bullet points, arrows, checkmarks, spinners. |
| `style.ts` | `c`, `bg` | Record | Direct static colorizer dictionaries for foregrounds (`c`) and backgrounds (`bg`). | Returns identity string when `chalk.level === 0`. |
| `helpers.ts` | `resolveThemeColor`, text formatting | Functions | Resolves theme color tokens and text formatting wrappers guarded by chalk level. | Respects `chalk.level === 0` for headless testing. |
| `index.ts` | Barrel exports | Module | Unified entry point exporting all theme tokens, figures, styles, and helpers. | Single mandatory import source for theme tokens. |

---

### 7. Settings System (`src/settings/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `store.ts` | `loadSettings`, `saveSettings`, `getSettingsPath` | Functions | Atomic persistence of user configuration in `~/.steward/settings.json`. | Uses atomic temp-file write + rename. |
| `model.ts` | `getSavedModel`, `saveModel`, `normalizeReasoningEffort` | Functions | Loads and updates persisted default LLM model selection and reasoning effort tier. | Remaps legacy `gemini` $\to$ `google`. |
| `mode.ts` | `getSavedMode`, `saveModeSelection` | Functions | Loads and updates default chat mode (`normal`, `chat`, `review`, `build`). | Validated strictly against `MODE_NAMES`. |
| `trust.ts` | `isFolderTrusted`, `trustFolder` | Functions | Workspace trust verification and registration. | Resolves exact paths and ancestors using `normalizeFolderPath`. |
| `index.ts` | Barrel exports | Module | Unified entry point exporting all CLI settings, model, mode, and trust functions. | Single import source for settings across the CLI. |

---

## Application Invariants & Architecture Rules

1. **Intra-Package Layer Boundaries (Rules 7–10):** All modules must follow the strict one-way dependency chain: `main.ts` $\to$ `cli/` $\to$ `app/` $\to$ `interface/` $\to$ `slash/`. No circular or upward imports are permitted.
2. **Subcommand Open-Closed Architecture:** Adding a CLI subcommand requires adding a folder in `src/cli/commands/` and registering it in `builtInCliCommands`. `run.ts` and `registry.ts` are command-agnostic.
3. **Type-Only Slash Boundary:** Slash commands must never import UI implementation code at runtime; imports from `src/interface/` must be `import type` only.
4. **Trust Gate Ordering:** External project and user lifecycle hooks are disabled until workspace trust is approved via `TrustGate`.
5. **Direct Shell & Slash Command Bypass:** Direct bash executions (`!<command>`) and `/slash` commands bypass agent turn LLM history.
