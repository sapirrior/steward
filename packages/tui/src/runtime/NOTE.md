# Directory: `packages/tui/src/runtime`

## 1. Overview & Single Responsibility

Application mount runtime, UI lifecycle management, deterministic update batching, post-frame effect queues, static string rendering (`renderToString`), and compatibility facades (`createApp`, `mount`).

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
State Update / Setter Trigger
       │
       ▼
┌───────────────────────────────┐
│         AppScheduler          │ ──► Coalesces rapid updates into microtask batch
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│            AppRoot            │ ──► reconcileRoot() ──► RootLineComponent
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│        TerminalEngine         │ ──► Double-buffering & synchronized output (Mode 2026)
└──────────────┬────────────────┘
               │
               ▼ (after successful frame write)
┌───────────────────────────────┐
│     flushEffects() (Queue)    │ ──► 1. useLayoutEffect (Sync) ──► 2. useEffect (Microtask)
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                | Primary Responsibility                                                                              | Exported Symbols                                 | Local / External Dependencies                                                                                          |
| :------------------ | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `AppRoot.ts`        | Root component container orchestrating reconciliation and engine line mounting.                     | `AppRoot`, `AppRootOptions`                      | `../engine/TerminalEngine.js`, `../reconciler/reconcile.js`, `./AppScheduler.js`                                       |
| `AppScheduler.ts`   | Microtask update batcher and post-frame effect dispatcher.                                          | `AppScheduler`                                   | `../engine/TerminalEngine.js`, `../reconciler/hooks.js`                                                                |
| `mount.ts`          | Mounts functional UI root into `TerminalEngine`, handles lifecycle, state updates, and typed input. | `mount`, `UIContext`, `MountOptions`, `UIHandle` | `../engine/TerminalEngine.js`, `../engine/Component.js`, `../terminal/input.js`, `../elements/index.js`, `../types.js` |
| `createApp.ts`      | High-level application bootstrap helper with engine instantiation.                                  | `createApp`, `CreateAppOptions`                  | `./mount.js`, `../engine/TerminalEngine.js`, `../terminal/io.js`                                                       |
| `renderToString.ts` | Synchronous static rendering of declarative element trees to plain terminal strings.                | `renderToString`, `RenderToStringOptions`        | `../elements/index.js`, `../terminal/color.js`                                                                         |
| `instance.ts`       | Base runtime instance contracts and identity tokens.                                                | `RuntimeInstance`                                | None                                                                                                                   |
| `index.ts`          | Public runtime barrel export.                                                                       | All runtime exports                              | Submodules                                                                                                             |
| `Scheduler.test.ts` | Targeted unit test suite for update coalescing and post-frame lifecycles.                           | None (Test suite)                                | `./AppScheduler.js`, `../engine/TerminalEngine.js`, `../terminal/io.js`                                                |

---

## 5. Detailed Symbol & Contract Breakdown

### `AppRoot.ts`

#### `AppRoot`

- **Type / Signature:** `class AppRoot`
- **Category / Tags:** `[Stateful]` `[I/O]`
- **Description:** Mounts and reconciles declarative root elements onto `TerminalEngine`, binding updates to `AppScheduler`.

---

### `AppScheduler.ts`

#### `AppScheduler`

- **Type / Signature:** `class AppScheduler`
- **Category / Tags:** `[Stateful]`
- **Description:** Coalesces multiple state setter dispatches within a microtask and executes `useLayoutEffect` and `useEffect` lifecycle queues strictly post-frame.

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

- **Safe Lifecycle:** Registered cleanup functions and unmount callbacks execute in strict `try...catch` blocks to prevent unhandled rejections during application teardown.
