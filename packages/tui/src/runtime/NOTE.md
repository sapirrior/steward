# Directory: `packages/tui/src/runtime`

## 1. Overview & Single Responsibility

Application mount runtime, UI lifecycle management, static string rendering (`renderToString`), and compatibility facades (`createApp`, `mount`).

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
renderFn(state, ctx)
       │
       ▼
┌───────────────────────────────┐
│     resolveElementTree        │ ──► Resolves ElementNode / Fragment / Class trees
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│   FunctionalRootComponent     │ ──► Component.renderWithCursor()
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│        TerminalEngine         │ ──► Double-buffering & synchronized output
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                | Primary Responsibility                                                                              | Exported Symbols                                 | Local / External Dependencies                                                                                          |
| :------------------ | :-------------------------------------------------------------------------------------------------- | :----------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| `mount.ts`          | Mounts functional UI root into `TerminalEngine`, handles lifecycle, state updates, and typed input. | `mount`, `UIContext`, `MountOptions`, `UIHandle` | `../engine/TerminalEngine.js`, `../engine/Component.js`, `../terminal/input.js`, `../elements/index.js`, `../types.js` |
| `createApp.ts`      | High-level application bootstrap helper with engine instantiation.                                  | `createApp`, `CreateAppOptions`                  | `./mount.js`, `../engine/TerminalEngine.js`, `../terminal/io.js`                                                       |
| `renderToString.ts` | Synchronous static rendering of declarative element trees to plain terminal strings.                | `renderToString`, `RenderToStringOptions`        | `../elements/index.js`, `../terminal/color.js`                                                                         |
| `instance.ts`       | Base runtime instance contracts and identity tokens.                                                | `RuntimeInstance`                                | None                                                                                                                   |
| `index.ts`          | Public runtime barrel export.                                                                       | All runtime exports                              | Submodules                                                                                                             |

---

## 5. Detailed Symbol & Contract Breakdown

### `mount.ts`

#### `mount`

- **Type / Signature:** `<S extends object>(engine: TerminalEngine, renderFn: (state: S, ctx: UIContext) => any, options?: MountOptions<S>) => UIHandle<S>`
- **Category / Tags:** `[Stateful]` `[I/O]`
- **Description:** Mounts a functional component root into the terminal engine, wire input events, and return a control handle.

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
