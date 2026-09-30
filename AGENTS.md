# AGENTS.md

Universal operational guidelines for AI coding agents working in the `steward` repository.

## 1. Project Overview & Tech Stack

`steward` is an interactive AI engineering assistant for the terminal — built with:

- **Language/Runtime:** TypeScript, executed natively by [Bun](https://bun.sh)
- **Model Orchestration & Tool Calling:** First-party zero-dependency AI engine (`@steward/ai`) supporting 11 providers (OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, GitHub Copilot, Groq, xAI, Mistral, Ollama, Custom).
- **Terminal User Interface (TUI):** Custom Alternate-Screen TUI Engine (`stitchable` / `@steward/tui`) with Mode 2026 Synchronized Output and line-differential rendering.

> Do not introduce alternative UI frameworks or external LLM wrapper libraries (`ai`, `@ai-sdk/*`, langchain, etc.) without explicit maintainer approval.

## 2. Source of Truth for Architecture

- **Zero External AI SDKs:** All LLM communication, streaming parsers, and tool calling runtime are maintained directly in `packages/ai/`.

## 3. Architecture & Modular Package Boundaries

All application source code resides in the root `packages/` directory across 4 isolated workspaces:

- **AI Runtime Package (`packages/ai/` / `@steward/ai`):**
  - Zero-dependency streaming inference engine, provider adapters (OpenAI, Anthropic, Gemini, OpenAI-compatible), auth resolution via environment variables, and dynamic model discovery.
- **TUI Package (`packages/tui/` / `stitchable`):**
  - Alternate-screen diff rendering engine (`engine/`), physical cell layout math (`layout/`), content-blind primitives (`primitives/`, `elements/`), color themes (`terminal/`), and JSX runtime (`runtime/`).
- **Agent Package (`packages/agent/` / `@steward/agent`):**
  - Agent session orchestration, multi-step turn runner, system prompt construction, chat modes/policy, tool catalog (15 tools), lifecycle hooks runtime (`hooks/`), and services (`services/` — session storage, CAS checkpoints, rewind, background tasks, settings).
- **CLI Package (`packages/cli/` / `@steward/cli`):**
  - CLI entry point (`src/main.ts`), application orchestrator (`src/app.ts`), slash commands (`src/commands/`), and domain UI components (`src/ui/components/`, `src/ui/utils/`).

## 4. Documentation & Package README Invariant

- **Package README Invariant:** Whenever modifying or adding code inside a package (`packages/ai`, `packages/tui`, `packages/agent`, `packages/cli`), you **MUST update the package's `README.md`** with accurate function, export, and tool breakdowns.
- Every package `README.md` must follow the Sonnet documentation convention (File $\to$ Export $\to$ Type $\to$ Description & Constraints).

## 5. Commands

Standard scripts defined in workspace root `package.json`:

| Command | Description |
| :--- | :--- |
| `bun run dev` | Run CLI directly from source in watch mode |
| `bun run start` | Run the CLI directly |
| `bun run build` | Bundle CLI to `./packages/cli/dist/cli.js` (Node-compatible) |
| `bun run compile` | Compile CLI to a standalone binary `./packages/cli/dist/steward` |
| `bun run format` | Check formatting with Prettier across packages |
| `bun run format:fix` | Auto-fix formatting across packages |
| `bun run lint:boundaries` | Check package architecture boundary rules |
| `bun test` | Run test suite across all workspace packages |

## 6. Rules & Boundaries

- **Strict Boundaries:** Never edit, delete, or generate files in `.agents/`. These are strictly human-managed.
- **Permission & Checkpoint Protection:** Workspace mutations and bash commands are gated by user permission and automated rewind checkpoints.
- **Secrets Policy:** Never commit secrets, API keys, credentials, or `.env*` files.
- **Workflow & Style:** Follow Conventional Commits and code formatting guidelines defined in [CONTRIBUTING.md](CONTRIBUTING.md).
- **Ambiguity:** Ask the maintainer for clarification instead of guessing or making unverified architectural assumptions.
