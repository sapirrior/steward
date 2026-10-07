# Agent Operational Rules & Working Guidelines

Core guidelines that all AI agents working in this repository must strictly follow:

---

## 1. Shell Commands & Output
- **Always limit bash command output:** Suffix shell commands with `2>&1 | tail -n 15` to avoid flooding the terminal context.

## 2. Workflow & Commits
- **Always follow explicit user instructions:** Do exactly what the user explicitly directs.
- **Small, atomic changes:** Make small, incremental modifications rather than huge sweeping changes.
- **Frequent commits:** Test after every change and commit with proper Conventional Commit messages (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
- **Clear summaries:** Always provide a concise summary of what was completed and what the next step is.

## 3. Code & Architecture Standards
- **Always import from `index.js` barrels:** Never import from deep private file paths.
- **Strict casing conventions:**
  - `PascalCase` for core class files (`QueryEngine.ts`, `ContentAddressedStore.ts`, `ShellTaskManager.ts`) and Tool folders (`tools/BashTool/`, `tools/FileEditTool/`).
  - `camelCase` for normal utility files, functions, variables, and directories (`systemPrompt.ts`, `diff.ts`, `atomicWrite.ts`, `normalizePath.ts`, `openUrl.ts`).
  - `kebab-case` for slash command folders (`slash/model/`, `slash/resume/`).
- **Colocated tests:** Keep unit tests right next to the file being tested (e.g. `agentLoop.test.ts` next to `agentLoop.ts`).
- **Separation of Utilities vs Services:**
  - `utils/` holds pure, synchronous, or stateless helpers (`fs/`, `diff/`, `paths.ts`, `openUrl.ts`, `bash.ts`).
  - `services/` holds stateful, asynchronous, or persistent subsystems (`session/`, `checkpoint/`, `tasks/`, `permissions/`, `context/`, `mcp/`, `lsp/`).
- **Minimal yet batteries-included:** Do not introduce unnecessary bloat (e.g. no redundant per-tool `UI.tsx` files since Steward handles rendering centrally).
- **Verify TUI goldens:** Visual snapshot characterization tests in `packages/cli/tests/tui/` must remain byte-identical and green across every step.
- **Strict package boundaries:** `agent`, `models`, `ai`, `oauth`, and `tui` must never import each other or `cli`.
