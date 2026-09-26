# A sub package named services for Steward for persistent infrastructure, session storage, and checkpoint management

This package encapsulates persistent infrastructure subsystems, file mutation safety, session storage, error reporting, background process execution, and configuration management for Steward.

---

## File & Function Breakdown

### Session Management (`session/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `store.ts` | `createSession` | Function | Initializes a new structured session document in memory. | Assigns unique session ID and timestamps. |
| | `saveSession` | Function | Atomically persists session document to disk under `~/.steward/sessions/<id>/session.json`. | Uses atomic temporary file renaming. |
| | `loadSession` | Function | Reads and validates a session file from disk. | Validates against Schema v1. |
| | `listSessions` | Function | Scans `~/.steward/sessions/` and returns session summaries. | Sorted descending by `updatedAt`. |
| | `deleteSession` | Function | Permanently removes a session and its associated logs. | Deletes session directory safely. |
| `schema.ts` | `SESSION_SCHEMA_VERSION` | Constant | Current schema version (`1`). | Frozen canonical schema. |
| `helpers.ts` | `recordTurn` | Function | Appends a completed model turn with usage metrics and tool records. | Updates session timestamps and token totals. |
| | `rehydrateSessionHistory` | Function | Reconstructs UIHistoryItems from session data and presentation logs. | Rehydrates model turns and direct bash executions. |
| `logs/store.ts` | `SessionLogWriter` / `loadSessionLog` | Class / Function | Appends and reads tolerance-checked presentation event journals (`~/.steward/session-logs/<date>/<id>.jsonl`). | Bound string lengths and projection builder. |

---

### Checkpoint & CAS Manager (`checkpoint/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `cas.ts` | `writeCasBlob` / `readCasBlob` | Function | Stores and retrieves immutable file blobs by SHA-256 hash in `~/.steward/checkpoints/cas/`. | Content-addressed storage with deduplication. |
| `path.ts` | `resolveDirectMutationPath` | Function | Resolves and bounds mutation file targets within the active workspace. | Rejects path traversal escaping workspace root. |
| | `computeWorkspaceHash` | Function | Computes stable hash identifier for the current workspace path. | Namespace key for checkpoint journals. |
| `lock.ts` | `MutationLockManager` | Class | Path-level concurrency lock manager serializing mutations per file. | Prevents race conditions during concurrent tool executions. |
| `tracker.ts` | `MutationCheckpointTracker` | Class | Captures pre-mutation CAS hashes before file writes and records turn journals. | Tracks created, modified, and deleted pre-images. |
| `rewind.ts` | `executeRewind` | Function | Rolls back workspace files to the pre-state of any chosen turn with external change detection. | Aborts safely if external process modified file in meantime. |

---

### Task & Process Execution (`tasks/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `manager.ts` | `TaskManager` | Class | Manages background shell tasks, lifecycle states, and active process maps. | Singleton task lifecycle manager. |
| `process.ts` | `TaskProcess` | Class | Wraps a spawned child process with buffered stdout/stderr tailing and exit listeners. | Ring buffer line retention with configurable cap. |
| `shell.ts` | `getPlatformShell` | Function | Detects OS platform shell binary and arguments (`bash`, `sh`, `powershell`). | Safe non-interactive execution flags. |

---

### Configuration, Errors & Updates (`config/`, `errors/`, `updater/`, `paths.ts`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `paths.ts` | `getStewardRootDir` | Function | Returns authoritative root directory for Steward files (`~/.steward` or env override). | Centralized source of truth for all paths. |
| | `getSessionsDir` / `getCheckpointsDir` | Function | Returns paths to sessions, checkpoints, and error logs directories. | Creates directories if missing. |
| `contracts.ts` | `ProviderName` / `ChatMode` | Type | Re-exported contracts and shared domain types for services. | Decouples services from agents package. |
| `config/settings.ts` | `loadSettings` / `saveSettings` | Function | Reads and writes `~/.steward/settings.json` preserving unknown user keys. | Tolerates unknown legacy keys (e.g. `voiceLanguage`). |
| | `getSavedMode` / `saveModeSelection` | Function | Persists and retrieves the active chat mode from `settings.json`. | Restored on application startup. |
| `config/env.ts` | `hasProviderConfig` / `getAvailableProviders` | Function | Detects API keys across 11 supported providers (`openai`, `anthropic`, `gemini`, `deepseek`, `openrouter`, `github-copilot`, `groq`, `xai`, `mistral`, `ollama`, `custom`). | Safe environment variable scanning. |
| `errors/classifier.ts` | `classifyError` | Function | Maps `@steward/ai` `AIError` instances, network drops, auth issues, and empty output into actionable StructuredError objects. | Structured classification with retryability. |
| `errors/logger.ts` | `logError` | Function | Logs structured error diagnostics with stack traces to `~/.steward/logs/errors-<date>.log`. | Prevents unhandled crash loss. |
| `errors/global-handler.ts` | `setupGlobalErrorHandlers` | Function | Attaches `uncaughtException` and `unhandledRejection` handlers to process. | Ensures graceful terminal restore and formatted error display. |
| `updater/service.ts` | `UpdateCheckerService` | Class | Read-only background checker for newer Steward CLI versions via GitHub repo releases. | Non-blocking, mutation-free update check. |

---

## Infrastructure Invariants & Safety

1. **Schema v1 Freeze**: The session document format and checkpoint manifest format are strictly frozen for backward compatibility.
2. **Atomic Disk Writes**: All persistent state saves use atomic temp file creation and atomic directory moves/renames.
3. **External Modification Protection**: The rewind subsystem verifies current file hashes against checkpoint post-states before restoring pre-images, preventing silent destruction of external edits.
