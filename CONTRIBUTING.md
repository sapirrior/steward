# Contributing to Steward

Thank you for your interest in contributing to **Steward**, the interactive AI engineering assistant for the terminal!

This guide outlines our development workflow, architectural standards, and contribution guidelines to make contributing as straightforward, safe, and productive as possible.

---

## 1. Getting Started

### Prerequisites

- **[Bun](https://bun.sh)** >= 1.1 (native runtime, package manager, and test runner)
- **Node.js** >= 20.0 (optional, for cross-runtime verification)
- **Git**

### Initial Setup

```bash
# 1. Clone the repository
git clone https://github.com/sapirrior/steward.git
cd steward

# 2. Install workspace dependencies
bun install

# 3. Verify the installation by running the test suite
bun test

# 4. Start Steward in local watch mode
bun run dev
```

---

## 2. Monorepo Architecture & Modular Packages

Steward is built as a strict, zero-dependency monorepo structured across 5 isolated workspaces in `packages/`:

```
steward/
├── packages/
│   ├── ai/          # @steward/ai — Zero-dependency streaming inference engine, wire protocols (Anthropic, Gemini, OpenAI Completions/Responses), and model discovery.
│   ├── tui/         # stitchable (@steward/tui) — Alternate-screen diff rendering engine (Mode 2026), layout math, primitives, and JSX runtime.
│   ├── agent/       # @steward/agent — Agent loop, turn runner, model ports, tool catalog (16 tools), policy/chat modes, session persistence, and CAS checkpoints.
│   ├── oauth/       # @steward/oauth — Zero-dependency OAuth credential store, PKCE/Device flows, and token lifecycle management.
│   └── cli/         # @steward/cli — Composition root (main.ts, runtime.ts), application orchestrator (app.ts), slash commands, and domain UI components.
└── .agents/         # System skills and prompt rules (Human-managed only).
```

### Architectural Boundaries & Hard Rules

1. **Strict Monorepo Hierarchy:**
   - **`@steward/cli`** is the only package permitted to import sibling packages (`ai`, `agent`, `tui`, `oauth`).
   - Non-CLI packages (`ai`, `agent`, `tui`, `oauth`) **must never import each other** or `@steward/cli`.
   - `@steward/agent` owns its own ports in `src/ports/model.ts` and interacts with inference purely through interfaces.
2. **Zero External AI SDKs:** All LLM communication, streaming parsers, and tool execution runtimes are maintained natively within `@steward/ai`. Do not introduce external LLM SDK wrappers (`ai`, `@ai-sdk/*`, `langchain`, etc.).
3. **Strict Boundaries:** Never edit, delete, or generate files in `.agents/`. These are human-managed.
4. **Secrets Policy:** Never commit secrets, API keys, credentials, or `.env*` files.

---

## 3. Standard Development Scripts

Run these scripts from the repository root:

| Command | Description |
| :--- | :--- |
| `bun run dev` | Run the CLI directly from source in live watch mode |
| `bun run start` | Run the CLI directly from source |
| `bun run build` | Bundle CLI into `./packages/cli/dist/cli.js` (Node-compatible) |
| `bun run compile` | Compile CLI into a standalone binary `./packages/cli/dist/steward` |
| `bun run format` | Check formatting with Prettier across all packages |
| `bun run format:fix` | Auto-fix formatting across all packages |
| `bun run lint:boundaries` | Enforce monorepo package boundary and layer rules |
| `bun run typecheck` | Run TypeScript type checking across all workspace packages |
| `bun test` | Execute the full test suite across all workspace packages |

---

## 4. Coding Standards & Invariants

### Documentation Standard (READMEDOC)
Every workspace package **MUST maintain a comprehensive `README.md`** file strictly following the **[READMEDOC.md](READMEDOC.md)** specification.
- Each package `README.md` serves as the authoritative, self-contained guide for both human developers and AI agents.
- Whenever adding, modifying, or removing code in a package, update that package's `README.md` within the same turn.

### Naming Conventions
- `PascalCase` for classes, interfaces, types, and primary class/component files.
- `camelCase` for functions, methods, variables, and standard filenames.
- Colocate unit tests alongside their corresponding source files (`*.test.ts`).


---

## 5. Testing & Verification

We maintain a fast, comprehensive test suite. Before submitting any changes, ensure all tests pass:

```bash
# 1. Run all tests
bun test

# 2. Check architecture boundaries
bun run lint:boundaries

# 3. Check types
bun run typecheck

# 4. Check formatting
bun run format
```

### Adding New Tests
- Place tests in `tests/` alongside the relevant package source code.
- Use `bun:test` primitives (`describe`, `it`, `expect`).
- Use mock transports for network calls (`createMockFetch`, fake SSE streams) so tests remain deterministic and run offline.

---

## 6. Commit Message Guidelines

We enforce [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body with details]
```

### Common Types:
- `feat`: New feature or capability
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `style`: Formatting, whitespace, or style changes
- `test`: Adding or updating test suites
- `docs`: Documentation updates
- `chore`: Tooling, build scripts, or dependency maintenance

### Examples:
- `feat(ai): add support for reasoning effort token budget in anthropic protocol`
- `fix(agent): preserve partial turn history on mid-stream abort`
- `refactor(cli): create runtime composition root in runtime.ts`

---

## 7. Pull Request Process

1. **Branch Naming:** Create a feature or fix branch from `main`:
   - `feat/add-new-provider`
   - `fix/error-badge-rendering`
2. **Focused Scope:** Keep pull requests focused on a single concern.
3. **Verification:** Verify that `bun test`, `bun run lint:boundaries`, and `bun run format` pass locally.
4. **Documentation:** Ensure all affected packages' `README.md` files are updated with accurate guides, ASCII diagrams, and symbol breakdowns per [READMEDOC.md](READMEDOC.md).
5. **Open PR:** Submit your pull request to the `main` branch with a clear description of the problem solved, approach taken, and testing performed.

Thank you for helping make Steward the most resilient, powerful AI engineering terminal assistant!
