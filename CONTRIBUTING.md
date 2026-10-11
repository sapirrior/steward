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

Steward is structured across isolated workspaces in `packages/`:

```
steward/
├── packages/
│   ├── sdk/         # @steward/sdk — Frontend-neutral agent engine built on Vercel AI SDK, request-scoped provider adapters, streaming, and error normalization.
│   ├── cli/         # steward-cli (@steward/cli) — Composition root (main.ts), credential resolver, host tools, and terminal/TUI integration.
│   ├── tui/         # stitchable (@steward/tui) — Alternate-screen diff rendering engine, layout primitives, and JSX runtime.
│   ├── oauth/       # @steward/oauth — Zero-dependency OAuth credential store, PKCE/Device flows, and token lifecycle management.
│   ├── models/      # @steward/models — Slim models.dev metadata and pricing client.
│   └── threads/     # @steward/threads — File-backed session and turn persistence.
└── .agents/         # System skills and prompt rules (Human-managed only).
```

### Architectural Boundaries & Hard Rules

1. **Strict Monorepo Hierarchy:**
   - **`@steward/cli`** is the only package permitted to import sibling packages (`sdk`, `models`, `oauth`, `threads`, `stitchable`).
   - Non-CLI library packages (`sdk`, `models`, `oauth`, `threads`, `stitchable`) **must never import each other** or `@steward/cli`.
   - `@steward/sdk` interacts purely with explicit caller options and request-scoped metadata, never reading `process.env`.
2. **Strict Boundaries:** Never edit, delete, or generate files in `.agents/`. These are human-managed.
3. **Secrets Policy:** Never commit secrets, API keys, credentials, or `.env*` files.

---

## 3. Standard Development Scripts

Run these scripts from the repository root:

| Command | Description |
| :--- | :--- |
| `bun run dev` | Run the CLI directly from source in live watch mode |
| `bun run start` | Run the CLI directly from source |
| `bun run build` | Bundle CLI into `./packages/cli/dist/cli.js` (Node-compatible) |
| `bun run compile` | Compile CLI into a standalone binary `./packages/cli/dist/steward` |
| `bun test` | Execute the full test suite across all workspace packages |
| `bun run test:sdk` | Execute tests for `@steward/sdk` |
| `bun run test:cli` | Execute tests for `@steward/cli` |
| `bun run format` | Check formatting with Prettier across all packages |
| `bun run format:fix` | Auto-fix formatting across all packages |
| `bun run typecheck` | Run TypeScript type checking across all workspace packages |

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

# 2. Check formatting
bun run format
```

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

---

## 7. Pull Request Process

1. **Branch Naming:** Create a feature or fix branch from `main`:
   - `feat/add-new-provider`
   - `fix/error-badge-rendering`
2. **Focused Scope:** Keep pull requests focused on a single concern.
3. **Verification:** Verify that `bun test` and `bun run format` pass locally.
4. **Documentation:** Ensure all affected packages' `README.md` files are updated with accurate guides, ASCII diagrams, and symbol breakdowns per [READMEDOC.md](READMEDOC.md).
5. **Open PR:** Submit your pull request to the `main` branch with a clear description of the problem solved, approach taken, and testing performed.
