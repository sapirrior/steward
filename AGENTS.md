# AGENTS.md

Universal operational guidelines for AI coding agents working in the `steward` repository.

## 1. Project Overview & Tech Stack

`steward` is an interactive AI engineering assistant for the terminal — built with:

- **Language/Runtime:** TypeScript, executed natively by [Bun](https://bun.sh)
- **Model Orchestration & Tool Calling:** Vercel AI SDK (`ai` v7)
- **Terminal User Interface (TUI):** Custom Alternate-Screen TUI Engine with Mode 2026 Synchronized Output and line-differential rendering

> Do not introduce alternative UI frameworks or LLM integration libraries without explicit maintainer approval.

## 2. Source of Truth for APIs & Libraries

- **Vercel AI SDK APIs:** Always consult reference skills in `.agents/skills/` before writing code. Do not hallucinate or rely on outdated pre-training memory for API signatures.

## 3. Architecture & Modular Package Boundaries

All application source code resides in `src/` under a structured modular layout:

- **Application Orchestration (`src/app/`):**
  - CLI entry point (`main.ts`), application orchestrator (`app.ts`), slash commands (`commands/`), and domain UI components (`ui/components/`, `ui/utils/`).
- **Agents Package (`src/packages/agents/`):**
  - Model provider integration, streaming agent loop, system prompt construction, chat modes/policy, skill discovery, and tool catalog (18 tools).
- **Services Package (`src/packages/services/`):**
  - Infrastructure subsystems: Session Schema v1 store, Checkpoint & CAS manager with atomic rewind, Background Shell Tasks, Todo state store, Settings/Config loader, and structured error logger.
- **TUI Package (`src/packages/tui/`):**
  - Alternate-screen diff rendering engine (`engine/`), physical cell layout math (`layout/`), content-blind primitives (`primitives/`), color themes (`theme/`), and formatting helpers (`format/`). Strictly follows the 3-layer architecture and frozen engine contract defined in [`src/packages/tui/Rules.txt`](src/packages/tui/Rules.txt).

## 4. Documentation & Package README Invariant

- **Package README Invariant:** Whenever modifying or adding code inside a package (`agents`, `services`, `tui`, or `app`), you **MUST update the package's `README.md`** with accurate function, export, and tool breakdowns.
- Every package `README.md` must follow the Sonnet documentation convention (File $\to$ Export $\to$ Type $\to$ Description & Constraints).

## 5. Commands

Standard scripts defined in `package.json`:

| Command | Description |
| :--- | :--- |
| `bun run dev` | Run directly from source in watch mode |
| `bun run start` | Run the CLI directly |
| `bun run build` | Bundle to `./dist/cli.js` (Node-compatible) |
| `bun run compile` | Compile to a standalone binary `./dist/steward` |
| `bun run format` | Check formatting with Prettier |
| `bun run format:fix` | Auto-fix formatting |
| `bun run lint:boundaries` | Check TUI 3-layer architecture boundary rules |
| `bun test` | Run tests (including headless golden snapshot suite) |

## 6. Rules & Boundaries

- **Strict Boundaries:** Never edit, delete, or generate files in `.agents/`. These are strictly human-managed.
- **Permission & Checkpoint Protection:** Workspace mutations and bash commands are gated by user permission and automated rewind checkpoints.
- **Session-Scoped Todos:** Operational todo state is persisted outside the repository at `~/.steward/todos/<sessionId>/todos.json`.
- **Secrets Policy:** Never commit secrets, API keys, credentials, or `.env*` files.
- **Workflow & Style:** Follow Conventional Commits and code formatting guidelines defined in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Ambiguity:** Ask the maintainer for clarification instead of guessing or making unverified architectural assumptions.
