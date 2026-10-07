# @steward/cli

The `@steward/cli` package serves as the executable entrypoint, command-line interface, application composition root, and terminal user interface for Steward. It orchestrates `@steward/ai`, `@steward/agent`, `@steward/oauth`, and `stitchable` into an interactive terminal engineering assistant.

---

## Table of Contents

- [Package Architecture & Boundaries](#package-architecture--boundaries)
- [Module & API Breakdown](#module--api-breakdown)
  - [1. Entry & CLI Executable Layer (`src/`, `src/cli/`)](#1-entry--cli-executable-layer-src-srccli)
  - [2. Application Composition & Orchestration (`src/app/`)](#2-application-composition--orchestration-srcapp)
  - [3. Query Engine & Session Orchestration (`src/query/`)](#3-query-engine--session-orchestration-srcquery)
  - [4. Interface Components & Controllers (`src/interface/`)](#4-interface-components--controllers-srcinterface)
  - [5. In-Session Slash Commands (`src/slash/`)](#5-in-session-slash-commands-srcslash)
  - [6. Utilities (`src/utils/`)](#6-utilities-srcutils)
  - [7. Theme System (`src/theme/`)](#7-theme-system-srctheme)
  - [8. Settings System (`src/settings/`)](#8-settings-system-srcsettings)
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

### 3. Query Engine & Session Orchestration (`src/query/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/query/AgentSession.ts` | `AgentSession`, `accumulateTokenUsage` | Class / Function | Manages conversational turn lifecycle, message history, token usage accumulation, checkpoint tracking, and session data. | Tracks active `AbortController`, enforces turn serialization, logs turn events to session log writer. |
| `src/query/QueryEngine.ts` | `runQueryTurn`, `RunQueryTurnOptions` | Function / Interface | Cleanly wraps `@steward/agent`'s `runAgentLoop` using `@steward/ai` model streaming and tool dispatch. | Translates loop events, computes turn summaries, and ensures 1:1 tool pairing. |
| `src/query/toolRunner.ts` | `executeToolCall` | Function | Executes individual tool calls against `defaultToolCatalog` with timing and error isolation. | Catches tool failures, computes `durationMs`, and returns structured `ToolResult`. |
| `src/query/turnContext.ts` | `prepareTurn`, `PreparedTurn` | Function / Interface | Prepares turn execution prerequisites including UUID, monotonic timestamps, CAS checkpoint tracker, and active tools. | Wires system prompt instructions, active mode permissions, and log adapter hooks. |
| `src/query/eventAdapter.ts` | `translateAgentEventToLogEvent` | Function | Adapts `AgentTurnEvent` notifications to persistent `SessionLogEvent` objects. | Formats tool execution start/end records with summaries and error states. |
| `src/query/types.ts` | Session, Turn, and Event contracts | Types / Interfaces | Domain types including `TurnSummary`, `AgentTurnEvent`, `SessionConfig`, and re-exported AI/tool types. | Pure type definitions for query and session consumers. |
| `src/query/index.ts` | Unified barrel exports | Module | Re-exports all query engine classes, runner functions, context builders, and type definitions. | Single entry point for `src/query`. |

---

### 4. Interface Components & Controllers (`src/interface/`)

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

### 5. In-Session Slash Commands (`src/slash/`)

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

### 6. Utilities (`src/utils/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `bash.ts` | `executeDirectBash` | Function | Executes direct user shell commands (`!<command>`) with real-time streaming output. | Bypasses LLM turn history and agent lifecycle hooks. |
| `open-url.ts` | `openUrl` | Function | Cross-platform utility to open URLs in default web browser. | Supports Linux (`xdg-open`), macOS (`open`), Termux, and Windows (`start`). |

---

### 7. Theme System (`src/theme/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `colors.ts` | `darkTheme`, `UITheme`, `SyntaxTheme` | Constant / Types | Canonical dark theme palette and semantic token definitions. | Pure data structure with zero runtime side-effects. |
| `figures.ts` | `figures`, `LOGO_LINES` | Constants | Terminal Unicode glyphs, ASCII fallback symbols, and logo art. | Bullet points, arrows, checkmarks, spinners. |
| `style.ts` | `c`, `bg` | Record | Direct static colorizer dictionaries for foregrounds (`c`) and backgrounds (`bg`). | Returns identity string when `chalk.level === 0`. |
| `helpers.ts` | `resolveThemeColor`, text formatting | Functions | Resolves theme color tokens and text formatting wrappers guarded by chalk level. | Respects `chalk.level === 0` for headless testing. |
| `index.ts` | Barrel exports | Module | Unified entry point exporting all theme tokens, figures, styles, and helpers. | Single mandatory import source for theme tokens. |

---

### 8. Settings System (`src/settings/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `store.ts` | `loadSettings`, `saveSettings`, `getSettingsPath` | Functions | Atomic persistence of user configuration in `~/.steward/settings.json`. | Uses atomic temp-file write + rename. |
| `model.ts` | `getSavedModel`, `saveModel`, `normalizeReasoningEffort` | Functions | Loads and updates persisted default LLM model selection and reasoning effort tier. | Remaps legacy `gemini` $\to$ `google`. |
| `mode.ts` | `getSavedMode`, `saveModeSelection` | Functions | Loads and updates default chat mode (`normal`, `chat`, `review`, `build`). | Validated strictly against `MODE_NAMES`. |
| `trust.ts` | `isFolderTrusted`, `trustFolder` | Functions | Workspace trust verification and registration. | Resolves exact paths and ancestors using `normalizeFolderPath`. |
| `index.ts` | Barrel exports | Module | Unified entry point exporting all CLI settings, model, mode, and trust functions. | Single import source for settings across the CLI. |

---

### 9. Services (`src/services/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `session/store.ts` | `createSession`, `saveSession`, `loadSession`, `listSessions`, `recordSessionTurn`, `renameSession` | Functions | Atomic persistence and discovery of session JSON documents in `~/.steward/sessions/<date>/`. | Temp-file + fsync + atomic rename; quarantine on schema mismatch. |
| `session/validate.ts` | `parseSessionDocument` | Function | Schema validation and error recovery for raw session JSON strings. | Validates version 1 schema; handles legacy aliases. |
| `session/helpers.ts` | `rehydrateSessionHistory`, `formatToolOutputSummary`, `mergeSessionPresentation` | Functions | Transforms session document turns and presentation logs into UI history items. | Formats tool execution output summaries. |
| `session/logs/store.ts` | `SessionLogWriter`, `loadSessionLog`, `buildSessionPresentationProjection`, `removeSessionLog` | Class / Functions | Append-only serialized JSONL writer and reader for turn presentation metadata. | Bounded output and error string limits. |
| `checkpoint/cas.ts` | `writeCasBlob`, `readCasBlob`, `hasCasBlob`, `verifyCasBlob`, `computeSha256` | Functions | Content-addressed storage for file pre- and post-images during mutations. | SHA-256 deduplication and verification. |
| `checkpoint/path.ts` | `resolveDirectMutationPath`, `computeWorkspaceHash`, `isPathInside` | Functions | Validates mutation target containment and symlink boundaries within workspace root. | Enforces workspace boundary safety. |
| `checkpoint/lock.ts` | `MutationLockManager`, `globalMutationLockManager` | Class / Instance | Asynchronous per-path mutex manager with deadlock-free multi-path locking. | Lexicographical lock ordering. |
| `checkpoint/store.ts` | `loadCheckpointManifest`, `saveCheckpointManifest`, `loadPendingJournal`, `savePendingJournal`, `commitTurnCheckpoint` | Functions | Manifest and journal persistence for multi-file workspace mutation checkpoints. | Serialized per-session atomic JSON writes. |
| `checkpoint/tracker.ts` | `MutationCheckpointTracker` | Class | Single-turn mutation tracker recording file pre-states and post-states. | Acquires per-path lock, captures CAS preimage before mutation. |
| `checkpoint/rewind.ts` | `executeRewind`, `recoverPendingCheckpoint` | Functions | Transactional rollback of conversation state and workspace files to target turn. | Multi-file locking, preflight CAS verification, and atomic rollback on conflict. |
| `tasks/process.ts` | `ShellExecution`, `getFilteredChildEnv` | Class / Function | Manages child shell process lifecycle, streaming output, automatic handoff, and input. | Sanitizes provider API keys from environment. |
| `tasks/manager.ts` | `ShellTaskManager` | Class | Lifecycle registry and cleanup manager for background and foreground shell tasks. | Enforces TTL eviction and capacity limits. |
| `permissions/permissions.ts` | `evaluateBashPermission` | Function | Evaluates command safety against command policy and delegates to permission dock handler. | Auto-approves safe read-only commands. |
| `permissions/shellRules.ts` | `classifyCommand` | Function | Pure classifier determining `SAFE_READ_ONLY` vs `REQUIRES_APPROVAL` for shell command strings. | Handles chained commands, quotes, and dangerous flags. |
| `permissions/filesystem.ts` | `isPathAccessible` | Function | Workspace containment check for filesystem operations. | Resolves against workspace root. |
| `context/systemPrompt.ts` | `buildSystemPrompt`, `buildSystemPromptSections`, `diffSystemPromptSections` | Functions | Modular system prompt builder with operating principles, date, cwd, and mode instructions. | Pure string template generation. |
| `errors/logger.ts` | `logError`, `serializeError`, `sanitizeContext` | Functions | Structured diagnostic error logger with secret redaction and system diagnostics. | Persists logs to `~/.steward/logs/<date>/<time>.log`. |
| `errors/globalHandler.ts` | `setupGlobalErrorHandlers`, `emergencyRestoreTerminal` | Functions | Installs uncaughtException and unhandledRejection handlers with terminal restoration. | Mode 2026 and mouse tracking reset. |
| `index.ts` | Barrel exports | Module | Unified entry point exporting all services sub-domains. | Single entry point for `src/services`. |

---

## Application Invariants & Architecture Rules

1. **Intra-Package Layer Boundaries (Rules 7–10):** All modules must follow the strict one-way dependency chain: `main.ts` $\to$ `cli/` $\to$ `app/` $\to$ `interface/` $\to$ `slash/`. No circular or upward imports are permitted.
2. **Subcommand Open-Closed Architecture:** Adding a CLI subcommand requires adding a folder in `src/cli/commands/` and registering it in `builtInCliCommands`. `run.ts` and `registry.ts` are command-agnostic.
3. **Type-Only Slash Boundary:** Slash commands must never import UI implementation code at runtime; imports from `src/interface/` must be `import type` only.
4. **Trust Gate Ordering:** External project and user lifecycle hooks are disabled until workspace trust is approved via `TrustGate`.
5. **Direct Shell & Slash Command Bypass:** Direct bash executions (`!<command>`) and `/slash` commands bypass agent turn LLM history.

