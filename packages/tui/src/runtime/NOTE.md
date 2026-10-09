# Directory: `packages/tui/src/runtime`

## 1. Overview & Single Responsibility

Application mount runtime, UI lifecycle management, deterministic update batching, post-frame effect queues, typed terminal input dispatching (`useInput`), size tracking (`useTerminalSize`), logical focus (`useFocus`), single-pass cursor emission (`useCursor`), static string rendering (`renderToString`), and compatibility facades (`createApp`, `mount`).

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Terminal Events (Keys / Bracketed Paste / Resize)
       │
       ▼
┌───────────────────────────────┐
│        TerminalEngine         │ ──► Mode 2026 Synchronized I/O
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       InputDispatcher         │ ──► Reverse-registration dispatch & focus filtering
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│  useInput / useFocus / App    │ ──► Handlers consume event or pass to fallback
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                     | Primary Responsibility                                                                              | Exported Symbols                                                                                                                    | Local / External Dependencies                                                                                               |
| :----------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| `AppRoot.ts`             | Root component container orchestrating reconciliation, AppContext, and engine line mounting.        | `AppRoot`, `AppRootOptions`, `extractReconciledElement`                                                                             | `../engine/TerminalEngine.js`, `../reconciler/reconcile.js`, `./AppScheduler.js`, `./InputDispatcher.js`, `./AppContext.js` |
| `AppScheduler.ts`        | Microtask update batcher and post-frame effect dispatcher.                                          | `AppScheduler`                                                                                                                      | `../engine/TerminalEngine.js`, `../reconciler/hooks.js`                                                                     |
| `AppContext.ts`          | Terminal-aware hooks and root application context.                                                  | `useApp`, `useTerminalSize`, `useCursor`, `useFocus`, `useInput`, `useCommitHistory`, `AppContext`, `AppContextValue`, `CursorPosition`, `TerminalSize`, `CommitHistoryOptions` | `../reconciler/context.js`, `../reconciler/hooks.js`, `../reconciler/static-render.js`, `./InputDispatcher.js` |
| `InputDispatcher.ts`     | Reverse-registration input event routing and logical focus coordinator.                             | `InputDispatcher`, `InputHandlerRecord`                                                                                                                                          | `../terminal/input.js`                                                                                        |
| `mount.ts`               | Mounts functional UI root into `TerminalEngine`, handles lifecycle, state updates, and typed input. | `mount`, `UIContext`, `MountOptions`, `UIHandle`                                                                                                                                 | `../engine/TerminalEngine.js`, `../engine/Component.js`, `../terminal/input.js`, `../elements/index.js`       |
| `createApp.ts`           | High-level application bootstrap helper with engine instantiation.                                  | `createApp`, `CreateAppOptions`                                                                                                                                                  | `./mount.js`, `../engine/TerminalEngine.js`, `../terminal/io.js`                                              |
| `renderToString.ts`      | Synchronous static rendering of declarative element trees to plain terminal strings.                | `renderToString`, `RenderToStringOptions`                                                                                                                                        | `../elements/index.js`, `../terminal/color.js`                                                                |
| `instance.ts`            | Base runtime instance contracts and identity tokens.                                                | `RuntimeInstance`                                                                                                                                                                | None                                                                                                          |
| `index.ts`               | Public runtime barrel export.                                                                       | All runtime exports                                                                                                                                                              | Submodules                                                                                                    |
| `Scheduler.test.ts`      | Targeted unit test suite for update coalescing and post-frame lifecycles.                           | None (Test suite)                                                                                                                                                                | `./AppScheduler.js`, `../engine/TerminalEngine.js`, `../terminal/io.js`                                       |
| `terminal-hooks.test.ts` | Targeted unit test suite for useInput, useFocus, useTerminalSize, and useCursor.                    | None (Test suite)                                                                                                                                                                | `./AppRoot.js`, `./AppContext.js`, `../terminal/io.js`                                                        |
| `history-hook.test.ts`   | Targeted unit test suite for renderStatic and useCommitHistory.                                     | None (Test suite)                                                                                                                                                                | `./AppRoot.js`, `./AppContext.js`, `../reconciler/static-render.js`, `../terminal/io.js`                      |


---

## 5. Detailed Symbol & Contract Breakdown

### `AppContext.ts`

#### `useInput`

- **Type / Signature:** `(handler: (event: InputEvent) => boolean | void, options?: { whenFocused?: boolean }) => void`
- **Category / Tags:** `[Stateful]`
- **Description:** Subscribes a typed input listener to the root dispatcher, supporting focus-filtered interception and bracketed paste handling.

#### `useTerminalSize`

- **Type / Signature:** `() => TerminalSize`
- **Category / Tags:** `[Stateful]`
- **Description:** Returns reactive terminal dimensions updated on engine resize events.

#### `useCursor`

- **Type / Signature:** `(position: CursorPosition | null) => void`
- **Category / Tags:** `[Stateful]`
- **Description:** Declares the active cursor line and character offset emitted by the root line component in the same render pass.

#### `useFocus`

- **Type / Signature:** `(options?: { id?: string; autoFocus?: boolean }) => { readonly id: string; readonly isFocused: boolean; focus(): void; blur(): void }`
- **Category / Tags:** `[Stateful]`
- **Description:** Manages logical component focus state and active focus ID in the application dispatcher.

---

## 6. Lifecycle & State Machine (ASCII)

```
[mount()] ──► onMount() ──► [Active / Rendering] ──► onKey() / update() ──► requestFrame()
                                     │
                                     ▼ (unmount / exit)
                                [Cleanups] ──► onUnmount() ──► [Unmounted]
```

---

## 7. Security, Permissions & Error Handling

- **Safe Input Containment:** Handlers in `useInput` execute synchronously inside the event dispatcher loop; unhandled errors do not leave raw terminal state hanging or break terminal modes.
