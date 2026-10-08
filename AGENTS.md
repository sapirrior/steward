# AGENTS.md

Operational guidelines and engineering rules for AI coding agents working in this repository.

---

## 1. Project Overview & Commands

- **Language / Runtime:** TypeScript with [Bun](https://bun.sh).

### Standard Commands

| Command | Description |
| :--- | :--- |
| `bun test` | Run the test suite |
| `bun run lint:boundaries` | Check package and module boundary rules |
| `bun run format` | Check code formatting |
| `bun run format:fix` | Fix code formatting |
| `bun run dev` | Run development mode |
| `bun run build` | Build / bundle the project |

---

## 2. Core Agent Rules & Workflow

AI agents working in this codebase must strictly adhere to the following rules:

### A. Small, Atomic, and Targeted Edits
- Make small, incremental modifications rather than large sweeping refactors.
- Be specific about what exact changes are being made and why before editing.
- Never rewrite entire files when targeted block replacements are sufficient.
- Avoid introducing unrequested dependencies, files, or speculative cleanups.

### B. Command Execution & Output Hygiene
- Limit shell command output to prevent flooding the context window (e.g., truncate or pipe verbose output).
- Never run unverified destructive commands.

### C. Follow Explicit Instructions
- Follow the user's explicit instructions strictly without assuming unstated requirements.
- When requirements or architectural paths are ambiguous, ask for clarification instead of guessing.

### D. Verification & Commits
- Test all modifications with the relevant test commands before concluding tasks.
- Keep tests green and ensure no regressions.
- Follow Conventional Commits format (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

---

## 3. Code Standards & Naming Conventions

- **Module Exports:** Import from established public entrypoints; avoid importing private deep file internals.
- **Naming Conventions:**
  - `PascalCase` for classes, interfaces, types, and primary class/component files.
  - `camelCase` for functions, methods, variables, and standard filenames.
- **Colocated Tests:** Place unit tests alongside the corresponding source files.
- **Modular Boundaries:** Respect package and module boundaries without creating circular dependencies.

---

## 4. Documentation Standard (NOTEDOC)

- **Per-Folder Documentation:** Follow the **[NOTEDOC.md](file:///home/nolan/works/steward/NOTEDOC.md)** specification.
- **`NOTE.md` Invariant:** Every folder (except workspace root) must maintain a dedicated `NOTE.md` tailored for AI agents, featuring structured ASCII navigation trees, ASCII diagrams, exact symbol signatures, and invariants.
- **Keep Synchronized:** Update the affected folder's `NOTE.md` within the same turn whenever adding, modifying, or removing code.

---

## 5. Security & Boundary Guardrails

- **Protected Folders:** Files inside `.agents/` are strictly human-managed; do not edit, create, or delete files in `.agents/`.
- **Secrets Policy:** Never commit secrets, API keys, credentials, or environment files.
