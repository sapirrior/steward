# NOTEDOC Specification Standard

The **NOTEDOC Specification Standard** defines the mandatory architectural documentation protocol for codebases maintained by AI coding agents.

Under this standard:
- **`README.md` files are completely out of scope:** Package and root `README.md` files serve solely as high-level human overviews and are strictly excluded from technical documentation requirements.
- **Exclusively Agent-Targeted:** Every `NOTE.md` is written specifically for autonomous AI coding agents to provide instant, unambiguous, and deterministic context without requiring full codebase scans.
- **Absolute Per-Folder Requirement:** **Every folder** across all packages and directories (except workspace root) **MUST have an explicit `NOTE.md`**, even if the folder contains only a single file, a lone constant variable, or type definitions.
- **Structured Subfolder Link Graphs:** When a folder contains subfolders, its `NOTE.md` MUST explicitly map and link to each child folder's `NOTE.md`.
- **Heavy ASCII Representation:** Because AI models parse spatial relationships, hierarchies, and state machines with high fidelity via character-based diagrams, **every `NOTE.md` must heavily incorporate ASCII graphs and flow diagrams**.

---

## 1. Universal Invariants

### Invariant 1: Total Directory Coverage
Every directory in the project tree (excluding workspace root and system/vcs directories such as `.git`, `node_modules`, `dist`) **MUST** contain a `NOTE.md`. There are no exceptions for minimal, single-file, or configuration-only folders.

### Invariant 2: Bidirectional & Downward Navigation
If directory `A/` contains subdirectories `B/` and `C/`, `A/NOTE.md` must include a structured ASCII directory tree containing direct Markdown links to `./B/NOTE.md` and `./C/NOTE.md`. Child notes can also provide an upward link `../NOTE.md` to maintain traversability.

### Invariant 3: Mandatory ASCII Modeling
Every `NOTE.md` must visually articulate the folder's architecture using ASCII diagrams. Text-only notes without ASCII structural representation are considered incomplete. Required diagrams include:
1. **Subfolder Directory Tree** (when child folders exist).
2. **Data Flow / Execution Pipeline Graph**.
3. **State / Lifecycle / Interaction Diagram** (where applicable).

### Invariant 4: Agent Synchronization
Whenever code inside a folder is added, refactored, renamed, or deleted, the folder's `NOTE.md` **MUST** be updated within the same turn to ensure zero documentation drift.

---

## 2. Standard Schema for `NOTE.md`

Every `NOTE.md` file must adhere to this structured layout:

```markdown
# Directory: `<relative/path/to/folder>`

## 1. Overview & Single Responsibility
<A concise summary defining the boundary, primary mission, and architectural role of this directory.>

---

## 2. Subfolder Navigation Tree

<!-- Mandatory if the folder has subdirectories; omit or mark None if leaf folder -->

```
.
├── [NOTE.md](./NOTE.md) (Current Folder)
├── [child-a/](./child-a/NOTE.md) ── Short description of child-a's domain
│   ├── [leaf-1/](./child-a/leaf-1/NOTE.md)
│   └── [leaf-2/](./child-a/leaf-2/NOTE.md)
└── [child-b/](./child-b/NOTE.md) ── Short description of child-b's domain
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

<!-- Visual model of how modules in this directory interact internally and with external consumers -->

```
┌─────────────────────────┐
│     Upstream Caller     │
└────────────┬────────────┘
             │ (Input Data / Command)
             ▼
┌─────────────────────────┐      ┌─────────────────────────┐
│   Primary Controller    │ ───► │ Secondary Helper / Hook │
└────────────┬────────────┘      └─────────────────────────┘
             │
             ▼ (Processed Output / Event Stream)
┌─────────────────────────┐
│   Downstream Consumer   │
└─────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File | Primary Responsibility | Exported Symbols | Local / External Dependencies |
| :--- | :--- | :--- | :--- |
| `constants.ts` | Static configuration and defaults. | `DEFAULT_CONFIG`, `VERSION` | None |
| `types.ts` | Domain data schemas and interfaces. | `Payload`, `ConfigOptions` | None |
| `handler.ts` | Request processing and transformation. | `processRequest`, `Handler` | `./types.ts`, `@external/dep` |

---

## 5. Detailed Symbol & Contract Breakdown

### `constants.ts`

#### `DEFAULT_CONFIG`
- **Type / Signature:** `const DEFAULT_CONFIG: Readonly<ConfigOptions>`
- **Category / Tags:** `[Constant]` `[Pure]`
- **Description:** Default fallback parameters applied when options are omitted.
- **Constraints & Invariants:** Immutable; values must adhere to bounds defined in `types.ts`.

---

### `handler.ts`

#### `processRequest`
- **Type / Signature:** `<T>(req: RequestPayload<T>, options?: ConfigOptions) => Promise<Result<T>>`
- **Category / Tags:** `[Async]` `[I/O]` `[Fallible]`
- **Description:** Validates incoming payload, executes transformation pipeline, and yields result.
- **Invariants & Failure Modes:**
  - Preconditions: `req.id` must be non-empty.
  - Side-Effects: Emits event to active listener if configured.
  - Thrown Errors: Throws `ValidationError` on malformed input.

---

## 6. Lifecycle & State Machine (ASCII)

<!-- State or lifecycle transitions if the module maintains state; otherwise mark Stateless -->

```
[Uninitialized] ──► init() ──► [Ready / Idle] ──► execute() ──► [Active / Processing]
                                      ▲                               │
                                      └──────── reset() ◄─────────────┘
```

- **Instantiation / Teardown:** How instances are created, pooled, or disposed.
- **Concurrency & Reentrancy:** Thread-safety, async locking, or concurrent execution constraints.
- **Boundary Rules:** Allowed vs. disallowed incoming and outgoing references.

---

## 7. Security, Permissions & Error Handling

- **Security / Permissions:** Elevated capabilities, user confirmation prompts, or access limitations.
- **Recovery / Fallbacks:** Retry policies, timeout defaults, fallback strategies, and unhandled failure containment.
```

---

## 3. Standard ASCII Modeling Patterns

AI agents should select and adapt the ASCII pattern that best fits the directory's architectural nature:

### Pattern A: Pipeline & Stage Processing
```
Input ──► [ Stage 1: Parse ] ──► [ Stage 2: Transform ] ──► [ Stage 3: Emit ]
                   │
                   ▼ (on failure)
          [ Error Recovery / Halt ]
```

### Pattern B: Decision & Routing Hub
```
                   ┌──────────────────────────┐
                   │    Incoming Dispatcher   │
                   └─────────────┬────────────┘
                                 │
                     Determine Action / Route
                     ├── Type A ──► [ Handler A ]
                     ├── Type B ──► [ Handler B ]
                     └── Fallback ─► [ Default Handler ]
```

### Pattern C: Client / Server or Request / Response Loop
```
   Caller                        Target Module
     │                                 │
     │ ────── 1. Invoke Request ─────► │
     │                                 ├─► [ Validate Input ]
     │                                 ├─► [ Execute Core Logic ]
     │ ◄───── 2. Return Result ─────── │
     │                                 │
```

---

## 4. Semantic Categorization Tags

To allow fast parsing by AI agents, symbols documented in Section 5 should be tagged with applicable category labels:

| Tag | Meaning |
| :--- | :--- |
| `[Pure]` | Deterministic, no state mutation, no side-effects. |
| `[Constant]` | Immutable static value or configuration dictionary. |
| `[Type / Interface]` | TypeScript type declaration or structural contract. |
| `[Stateful]` | Holds in-memory or external state across invocations. |
| `[Async]` | Returns a `Promise` or handles asynchronous execution. |
| `[Streaming]` | Returns an `AsyncGenerator`, `ReadableStream`, or event emitter. |
| `[I/O]` | Reads from or writes to filesystem, socket, or network. |
| `[Gated]` | Requires user permission or security authorization before execution. |
| `[Fallible]` | Throws specific domain errors on failure conditions. |

---

## 5. Verification Protocol for AI Coding Agents

When working on any task:
1. **Locate Local `NOTE.md`:** Always inspect the local `NOTE.md` before reasoning about or editing files in that folder.
2. **Create if Missing:** If a folder lacks a `NOTE.md`, generate it following this standard immediately.
3. **Keep Child Links Synchronized:** If creating a new subfolder, update the parent's `NOTE.md` subfolder tree and link to the new subfolder's `NOTE.md`.
4. **Update File & Symbol Matrices:** Accurately update changed signatures, return types, constants, and error conditions.
5. **Update ASCII Diagrams:** If the data flow, pipeline stages, or states changed, adjust the ASCII diagram to match the real code paths.
