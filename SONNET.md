# Sonnet Documentation Convention Specification

The **Sonnet Documentation Convention** is the mandatory, deterministic API and architecture documentation standard across all packages in the Steward monorepo (`packages/ai`, `packages/agent`, `packages/tui`, `packages/cli`, `packages/oauth`).

It ensures that both human developers and autonomous AI coding agents can instantly understand, navigate, and verify module boundaries, exported contracts, typing guarantees, and behavioral constraints without grepping through thousands of lines of source code.

---

## 1. Core Philosophy & Invariant

1. **Zero Guesswork:** Every exported function, class, type, interface, constant, and tool must be documented with its exact type signature and operational constraints.
2. **Deterministic Layout:** Documentation follows a strict hierarchical progression:
   $$\text{File} \longrightarrow \text{Export / Symbol} \longrightarrow \text{Type / Signature} \longrightarrow \text{Description} \longrightarrow \text{Key Details \& Constraints}$$
3. **The Package README Invariant:** Whenever modifying or adding code inside any workspace package, the package's `README.md` **MUST** be kept 100% in sync with actual exported symbols and behavioral invariants.

---

## 2. Standard Structure of a Sonnet README

Every package `README.md` must adhere to this uniform structure:

```markdown
# @steward/<package-name>

<One-paragraph summary of the package's single responsibility, zero-dependency boundaries, and core role.>

---

## Table of Contents
- [Package Architecture & Boundaries](#package-architecture--boundaries)
- [Module & API Breakdown](#module--api-breakdown)
  - [1. Subsystem A (`src/path/`)](#1-subsystem-a-srcpath)
  - [2. Subsystem B (`src/path/`)](#2-subsystem-b-srcpath)
- [Architectural Invariants & Constraints](#architectural-invariants--constraints)

---

## Package Architecture & Boundaries
<Concise overview of layer position, package boundaries, and external/internal dependencies.>

---

## Module & API Breakdown

### 1. Subsystem Name (`src/dir/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `module.ts` | `functionName` | `(param: Type) => ReturnType` | High-level summary of action. | Preconditions, side-effects, error modes. |

...
```

---

## 3. Table Column Specifications

The centerpiece of the Sonnet convention is the **Standardized API Table**:

| Column Name | Required Format | Description & Rules |
| :--- | :--- | :--- |
| **`File`** | Relative path (e.g. `client.ts`, `src/engine/runner.ts`) | The exact source file containing the declaration. |
| **`Export / Item`** | Code-formatted symbol (e.g. `` `createAI` ``, `` `ModelPort` ``) | The named export or major internal contract. Group related exports from the same file into adjacent rows. |
| **`Type`** | TypeScript signature or category | Either the explicit TypeScript signature (for functions/methods) or structural category (`Interface`, `Class`, `Type`, `Constant`). |
| **`Description`** | Sentence / Phrase | Clear, operational explanation of what the component achieves. Avoid restating obvious type names. |
| **`Key Details / Constraints`** | Bullet points or concise notes | Essential invariants: permissions, fallback behaviors, boundary limits, error types thrown, immutability guarantees. |

---

## 4. Reference Examples by Package

### Example A: Functional & Port Layer (`@steward/agent`)

```markdown
### Engine Modules (`src/engine/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `agent-session.ts` | `AgentSession` | Class | Manages in-memory agent lifecycle, model selection, reasoning effort, turn execution, and session persistence. | Injected with `ModelPort` (`deps: { ai: ModelPort }`). Implements turn loop orchestration. |
| `system-prompt.ts` | `buildSystemPrompt` | `(ctx: PromptContext) => string` | Assembles dynamic, modular system instructions including workspace context, mode policy, and skills. | Ultra-compact base (~450 tokens). Injects skill catalog instructions on demand. |
| `system-prompt.ts` | `diffSystemPromptSections` | `(prev: Section[], next: Section[]) => SectionPatch` | Computes delta patches between prompt assemblies. | Enables model prompt caching optimizations. |
```

### Example B: Wire Protocol & Client Engine (`@steward/ai`)

```markdown
### AI Client & Streaming (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `client.ts` | `createAI` | `(opts?: CreateAIOptions) => AI` | Central factory constructing the streaming AI runtime. | Zero external SDKs. Seeds builtin providers and manages dynamic `models.dev` catalog. |
| `errors.ts` | `AIError` | `class extends Error` | Standard domain error with `code: AIErrorCode`. | Codes: `rate-limit`, `auth`, `context-overflow`, `invalid-request`, `provider`, `network`, `aborted`. Parses nested JSON envelopes into human-readable messages. |
| `util/retry.ts` | `withRetry` | `<T>(req: RetryableRequest<T>, opts?: RetryOptions) => Promise<T>` | Wraps fetch requests with exponential backoff. | Max 10 attempts, 1.5x multiplier, mid-stream event notification via `onRetry`. |
```

### Example C: Tool Catalog Reference (`@steward/agent`)

```markdown
### Tools Catalog (`src/tools/`)

| File | Tool Name | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- |
| `read-file/` | `read_file` | Reads workspace file content with line numbers. | Read-only; bounded line window; returns line count and content. |
| `edit-file/` | `edit_file` | Performs exact string replacements in an existing file. | Requires user permission; records pre-mutation CAS checkpoint; validates single continuous chunk match. |
| `bash/` | `bash` | Runs a shell command securely in the workspace. | Gated by user permission; streams stdout/stderr; records timeout and exit code. |
```

---

## 5. Maintenance Checklist for Maintainers & Agents

Before concluding any feature, bug fix, or refactor:

- [ ] **Check Workspace:** Identify which packages in `packages/*` were modified.
- [ ] **Check Exports:** Did any export signature, return type, or parameter change?
- [ ] **Update README:** Open `packages/<pkg>/README.md` and verify all tables match the current implementation.
- [ ] **Verify Constraints:** Document newly added error behaviors, timeouts, backoff policies, or permission gates.
- [ ] **Format:** Run `bun run format:fix` to ensure clean markdown table alignment.
