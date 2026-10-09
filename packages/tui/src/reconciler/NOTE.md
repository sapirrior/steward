# Directory: `packages/tui/src/reconciler`

## 1. Overview & Single Responsibility

Implements declarative JSX element descriptors, synchronous keyed tree reconciliation, component instance identity preservation, fundamental React-style hooks (`useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`), class component lifecycles, and error boundary recovery for the Stitchable terminal UI runtime.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Function Component Execution
       │
       ▼
┌───────────────────────────────┐
│   prepareToRenderInstance()   │ ──► Sets active ComponentInstance slot pointer
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│     Hooks Invocation Loop     │
│   (useState, useEffect, ...)  │ ──► Reads/writes HookSlot records on instance
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│   finishRenderingInstance()   │ ──► Validates hook count & cleans active pointer
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│     reconcileChildList()      │ ──► Keyed matching & child subtree reuse
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                | Primary Responsibility                                                                 | Exported Symbols                                                                                                                                                                                  | Local / External Dependencies                                                                               |
| :------------------ | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| `element.ts`        | Factory functions for JSX element descriptors and child normalization.                 | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, `ELEMENT_TYPE_SYMBOL`, `isElement`, `normalizeChildren`                                                                                                      | `../types.ts`                                                                                               |
| `instance.ts`       | Component instance models, tags, and slot record initialization.                       | `createInstance`, `ComponentInstance`, `InstanceTag`                                                                                                                                              | `../types.ts`, `../engine/Component.js`                                                                     |
| `hooks.ts`          | Fundamental React-style hook primitives, slot records, and hook dispatcher.            | `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`, `prepareToRenderInstance`, `finishRenderingInstance`, `cleanupInstanceEffects`, `getPendingEffects` | `./instance.js`                                                                                             |
| `reconcile.ts`      | Keyed synchronous reconciler, instance lifecycle updates, and error boundary recovery. | `reconcileRoot`, `reconcileInstance`, `unmountTree`, `unmountInstance`, `RuntimeContext`                                                                                                          | `./element.js`, `./instance.js`, `./hooks.js`, `./errors.js`, `../types.ts`, `../engine/Component.js`       |
| `errors.ts`         | Error boundary detection, diagnostic error classes, and error metadata.                | `isErrorBoundaryClass`, `ComponentRenderError`, `ErrorInfo`                                                                                                                                       | None                                                                                                        |
| `element.test.ts`   | Unit tests for JSX descriptors and normalization.                                      | None (Test suite)                                                                                                                                                                                 | `./element.ts`, `../types.ts`, `../elements/index.ts`, `../engine/Component.ts`                             |
| `reconcile.test.ts` | Unit tests for keyed reconciliation, persistent instances, and error boundaries.       | None (Test suite)                                                                                                                                                                                 | `./reconcile.ts`, `./element.ts`, `../engine/Component.ts`                                                  |
| `hooks.test.ts`     | Unit tests for fundamental hook slots, state updates, memoization, and effects.        | None (Test suite)                                                                                                                                                                                 | `./hooks.ts`, `./reconcile.ts`, `./element.ts`, `../runtime/AppScheduler.js`, `../engine/TerminalEngine.js` |

---

## 5. Detailed Symbol & Contract Breakdown

### `hooks.ts`

#### `useState`

- **Type / Signature:** `<S>(initial: S | (() => S)) => [S, (action: StateAction<S>) => void]`
- **Category / Tags:** `[Stateful]`
- **Description:** Allocates or retrieves a persistent state slot for the current component instance and returns state with an updater function.

#### `useEffect`

- **Type / Signature:** `(effect: () => void | (() => void), deps?: DependencyList) => void`
- **Category / Tags:** `[Stateful]`
- **Description:** Enqueues a passive side-effect to execute in a microtask after the terminal frame is rendered.

#### `useLayoutEffect`

- **Type / Signature:** `(effect: () => void | (() => void), deps?: DependencyList) => void`
- **Category / Tags:** `[Stateful]`
- **Description:** Enqueues a layout effect to execute synchronously in the engine's post-frame flush immediately after `StateRenderer` writes bytes.

---

## 6. Lifecycle & State Machine (ASCII)

```
[reconcileInstance]
       │
       ├── First Render ──► [createInstance] ──► [render()] ──► componentDidMount() ──► [Mounted]
       │                                                                                   │
       ├── Rerender ─────► [props/state update] ──► [render()] ──► componentDidUpdate() ───┤
       │                                                                                   │
       └── Removed ──────► [unmountInstance] ──► cleanupInstanceEffects() ─────────────► [Unmounted]
```

---

## 7. Security, Permissions & Error Handling

- **Rules-of-Hooks Enforcement:** Invocations outside of function components or order/count alterations throw descriptive errors immediately.
- **Render-Phase State Guard:** State mutations during component render execution are prohibited and throw explicit diagnostics.
