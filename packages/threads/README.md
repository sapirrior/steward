# Package Name (`@steward/threads`)

Hardened, zero-dependency, crash-resilient AI conversation thread persistence engine for Steward.

---

## 1. Overview & Architecture

### High-Level Mental Model
`@steward/threads` manages the persistent lifecycle of AI conversation threads in Steward. It delivers:
- **Zero-Dependency Persistence:** Pure TypeScript using Node.js / Bun runtime built-ins (`node:fs/promises`, `node:crypto`, `node:path`, `node:os`).
- **Verbatim AI SDK v7 `ModelMessage[]` Storage:** Stores exact, unmutated conversation turns (`system`, `user`, `assistant`, `tool`), including rich content parts (`reasoning`, `tool-call`, `tool-result`, `file`, `text`).
- **Deterministic SHA-256 Identifiers:** Generates uniform `th_<16hex>` thread identifiers with zero collision risk.
- **Crash-Resilient Atomic Writes:** Writes to temporary files, flushes disk buffers via `fsync`, permission-locks to `0o600` (`rw-------`), and atomically renames with Windows `EPERM`/`EBUSY` retry loops.
- **In-Process Mutation Serialization:** Serializes `mutate(id, updater)` calls to protect against race conditions and lost updates.
- **Path Traversal Shield:** Sanitizes all thread identifiers, preventing malicious filesystem escapes.

### Architecture & Data Flow (ASCII Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            @steward/threads Engine                          │
└─────────────────────────────────────────────────────────────────────────────┘

 Caller (@steward/cli / Agent Loop)
       │
       ├─── create({ model, cwd, git }) ──► in-memory ThreadDocument
       │
       ├─── mutate(id, async (thread) => { ... })
       │         │
       │         ▼
       │   ┌───────────────────────────┐
       │   │ In-Process Mutation Queue │ (Per-thread concurrency serialization)
       │   └─────────────┬─────────────┘
       │                 │
       │                 ▼
       │   ┌───────────────────────────┐
       │   │ Atomic JSON Writer        │
       │   │ - .tmp.<id>.<ts>.<rand>   │
       │   │ - 0o600 File Permissions  │
       │   │ - fsync (flush disk cache)│
       │   │ - Atomic Rename + Retries │
       │   └─────────────┬─────────────┘
       │                 │
       │                 ▼
       │     ~/.steward/threads/th_<id>.json (0o600)
       │
       ├─── list() ──► ThreadSummary[] (Sorted by updatedAt DESC, skips corrupt files)
       ├─── load(id) ──► ThreadDocument | null
       └─── delete(id) ──► boolean
```

### Key Technical Invariants

1. **Zero External Runtime Dependencies:** Relies strictly on standard runtime modules (`node:crypto`, `node:fs`, `node:os`, `node:path`).
2. **Zero Sibling Dependencies:** Self-contained within `packages/threads`; never imports from `@steward/tui`, `@steward/models`, `@steward/oauth`, or `@steward/cli`.
3. **Pristine Message History:** Canonical turns store ordered `ModelMessage[]` directly from inference. No lossy conversions or formatting filters.
4. **Pure Token Counts:** Persists token counts (`inputTokens`, `outputTokens`, `totalTokens`, `reasoningTokens`, `cacheReadTokens`, `cacheWriteTokens`) without storing volatile calculated costs.
5. **Atomic Durability:** Every save performs a synchronized flush (`handle.sync()`) before replacement.

---

## 2. Quick Start & Basic Usage

```typescript
import {
  threadStore,
  generateThreadId,
  generateThreadTitle,
  type ThreadDocument,
} from '@steward/threads';

// 1. Create a new thread document
const thread = threadStore.create({
  model: {
    provider: 'anthropic',
    modelId: 'claude-3-7-sonnet',
    reasoning: 'medium',
  },
  cwd: process.cwd(),
  messages: [
    {
      role: 'user',
      content: 'Refactor terminal reconciler for bracketed paste',
    },
  ],
});

// 2. Persist to disk atomically
await threadStore.save(thread);

// 3. Mutate thread safely (e.g. append new turn & accumulate tokens)
await threadStore.mutate(thread.id, (t) => {
  t.messages.push({
    role: 'assistant',
    content: [{ type: 'text', text: 'Inspecting paste handlers...' }],
  });
  t.usage.inputTokens += 1500;
  t.usage.outputTokens += 250;
});

// 4. List threads for CLI picker (most recent first)
const summaries = await threadStore.list();
for (const s of summaries) {
  console.log(`${s.id}: ${s.title} (${s.messageCount} messages)`);
}

// 5. Load thread by ID
const loaded = await threadStore.load(thread.id);
```

---

## 3. Core Concepts & Mental Model

### Thread Identifiers (`th_<16hex>`)
Thread IDs are generated using `crypto.createHash('sha256')` across timestamp, working directory, and cryptographic random salt.
- Produces 16 hex characters prefixed with `th_` (e.g. `th_7a8f3b92c4e1d09a`).
- Provides $16^{16} \approx 1.84 \times 10^{19}$ unique combinations, preventing collisions while remaining readable in terminal UIs.

### Auto-Generated Titles
`generateThreadTitle(prompt)` extracts a concise summary from the first user prompt:
- Normalizes consecutive whitespace, tabs, and newlines.
- Truncates at natural word boundaries up to 48 characters with an ellipsis (`...`).
- Defaults to `'New Thread'` if the prompt is empty.

### Atomic Mutate (`mutate`)
The `mutate(id, updater)` method locks concurrent updates to the same thread ID in memory. It:
1. Waits for any previous mutation on that thread ID to finish.
2. Loads the current `ThreadDocument` from disk.
3. Executes the user's updater callback (sync or async).
4. Atomically flushes and saves the document back to disk.

---

## 4. API & Contract Reference

### Primary Contracts (`src/threadTypes.ts`)

#### `ModelMessage`
```typescript
export type ModelMessage =
  | SystemModelMessage
  | UserModelMessage
  | AssistantModelMessage
  | ToolModelMessage;
```

#### `ThreadUsage`
```typescript
export interface ThreadUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}
```

#### `ThreadDocument`
```typescript
export interface ThreadDocument {
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: ThreadModelMeta;
  metadata: ThreadMetadata;
  usage: ThreadUsage;
  messages: ModelMessage[];
}
```

#### `ThreadSummary`
```typescript
export interface ThreadSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: ThreadModelMeta;
  cwd: string;
  gitBranch?: string;
  messageCount: number;
  usage: ThreadUsage;
}
```

---

## 5. Functions & Utilities Reference

### `ThreadStore`
- **`create(options: CreateThreadOptions): ThreadDocument`**: Creates in-memory thread document.
- **`load(id: string): Promise<ThreadDocument | null>`**: Loads document from disk; returns `null` if not found.
- **`save(thread: ThreadDocument): Promise<void>`**: Atomically writes document to disk.
- **`mutate(id: string, updater: (t: ThreadDocument) => void | Promise<void>): Promise<ThreadDocument>`**: Serialized read-modify-save transaction.
- **`list(): Promise<ThreadSummary[]>`**: Lists thread summaries sorted by `updatedAt` DESC.
- **`getLatest(): Promise<ThreadDocument | null>`**: Returns the most recently updated thread.
- **`delete(id: string): Promise<boolean>`**: Deletes thread file; returns `true` if found and unlinked.

### Standalone Helpers
- **`generateThreadId(seed?: GenerateThreadIdSeed): string`**: Returns SHA-256 thread ID.
- **`generateThreadTitle(prompt: string): string`**: Formats and truncates prompt title.

---

## 6. Real-World Gotchas, Tips & Edge Cases

1. **Path Traversal Protection:**
   `getThreadPath(id)` strictly extracts `path.basename(id)` and strips any characters not matching `[a-zA-Z0-9_-]`. Any attempt to pass `../../` will resolve directly inside the threads storage directory.
2. **Windows File Locking Backoff:**
   Antivirus and search indexers on Windows can briefly lock files during atomic `rename()`. The engine retries up to 5 times with exponential backoff on `EPERM` or `EBUSY`.
3. **Resilience to Corrupt JSON Files:**
   If a user edits a file manually or a process crashes mid-edit, `.list()` gracefully ignores corrupted files without throwing or interrupting the CLI picker.

---

## 7. Directory & Module Map

```
packages/threads/
├── src/
│   ├── index.ts             # Package root exports
│   ├── threadTypes.ts       # Domain contracts (ThreadDocument, ModelMessage, ThreadSummary)
│   ├── threadErrors.ts      # ThreadStorageError domain error class
│   ├── generateId.ts        # SHA-256 thread identifier generator
│   ├── generateTitle.ts     # Word-boundary auto-title generator
│   ├── threadStore.ts       # ThreadStore implementation (CRUD & mutate)
│   └── threadStore.test.ts  # Test suite verifying CRUD, atomic writes, and security
├── package.json             # Workspace package definition (@steward/threads)
├── tsconfig.json            # TypeScript configuration
└── README.md                # Authoritative READMEDOC documentation manual
```

---

## 8. Verification & Testing

Run unit tests via Bun:

```bash
bun test ./packages/threads/src
```
