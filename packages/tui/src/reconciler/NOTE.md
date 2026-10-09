# Directory: `packages/tui/src/reconciler`

## 1. Overview & Single Responsibility

Implements declarative JSX element descriptors, synchronous keyed tree reconciliation, component instance identity preservation, fundamental React-style hooks (`useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`), Context dependency injection (`createContext`, `useContext`), subtree memoization (`memo`), class component lifecycles, and error boundary recovery for the Stitchable terminal UI runtime.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Context & Memoization Flow
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│     Context.Provider value    │ │      memo(Component)          │
└──────────────┬────────────────┘ └──────────────┬────────────────┘
               │                                 │
               ▼                                 ▼
┌───────────────────────────────┐        [ shallowEqual(prevProps, nextProps) ]
│  pushContext / popContext     │                ├── true  ──► [ Skip invocation, reuse renderedChild ]
└──────────────┬────────────────┘                └── false ──► [ Re-render component ]
               │
               ▼
┌───────────────────────────────┐
│   useContext(Context) reader  │
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                | Primary Responsibility                                                                 | Exported Symbols                                                                                                                                                                                  | Local / External Dependencies                                                                                                      |
| :------------------ | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------------------------- |
| `element.ts`        | Factory functions for JSX element descriptors and child normalization.                 | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, `ELEMENT_TYPE_SYMBOL`, `isElement`, `normalizeChildren`                                                                                                      | `../types.ts`                                                                                                                      |
| `instance.ts`       | Component instance models, tags, and slot record initialization.                       | `createInstance`, `ComponentInstance`, `InstanceTag`                                                                                                                                              | `../types.ts`, `../engine/Component.js`                                                                                            |
| `hooks.ts`          | Fundamental React-style hook primitives, slot records, and hook dispatcher.            | `useState`, `useReducer`, `useRef`, `useMemo`, `useCallback`, `useEffect`, `useLayoutEffect`, `prepareToRenderInstance`, `finishRenderingInstance`, `cleanupInstanceEffects`, `getPendingEffects` | `./instance.js`                                                                                                                    |
| `context.ts`        | Context dependency injection engine and scoped Provider management.                    | `createContext`, `useContext`, `pushContextValue`, `popContextValue`, `getActiveContextValue`, `Context`                                                                                          | `../types.ts`, `./element.js`, `./instance.js`                                                                                     |
| `memo.ts`           | Shallow prop equality comparator and component memoization wrapper.                    | `memo`, `shallowEqual`                                                                                                                                                                            | `../types.ts`                                                                                                                      |
| `static-render.ts`  | Static history snapshot evaluator rejecting stateful hooks and class lifecycles.       | `renderStatic`, `RenderStaticOptions`                                                                                                                                                             | `../types.ts`, `../terminal/color.js`, `../elements/Box.js`, `./element.js`, `../engine/Component.js`                             |
| `reconcile.ts`      | Keyed synchronous reconciler, instance lifecycle updates, and error boundary recovery. | `reconcileRoot`, `reconcileInstance`, `unmountTree`, `unmountInstance`, `RuntimeContext`                                                                                                          | `./element.js`, `./instance.js`, `./hooks.js`, `./context.js`, `./memo.js`, `./errors.js`, `../types.js`, `../engine/Component.js` |

| `errors.ts`         | Error boundary detection, diagnostic error classes, and error metadata.                | `isErrorBoundaryClass`, `ComponentRenderError`, `ErrorInfo`                                                                                                                                       | None                                                                                                                               |
| `element.test.ts`   | Unit tests for JSX descriptors and normalization.                                      | None (Test suite)                                                                                                                                                                                 | `./element.ts`, `../types.ts`, `../elements/index.ts`, `../engine/Component.ts`                                                    |
| `reconcile.test.ts` | Unit tests for keyed reconciliation, persistent instances, and error boundaries.       | None (Test suite)                                                                                                                                                                                 | `./reconcile.ts`, `./element.ts`, `../engine/Component.ts`                                                                         |
| `hooks.test.ts`     | Unit tests for fundamental hook slots, state updates, memoization, and effects.        | None (Test suite)                                                                                                                                                                                 | `./hooks.ts`, `./reconciler/reconcile.ts`, `./element.ts`, `../runtime/AppScheduler.js`, `../engine/TerminalEngine.js`             |
| `context.test.ts`   | Unit tests for scoped Context.Provider and useContext resolution.                      | None (Test suite)                                                                                                                                                                                 | `./context.ts`, `./element.ts`, `./reconcile.ts`                                                                                   |
| `memo.test.ts`      | Unit tests for component memoization and WeakMap layout caching.                       | None (Test suite)                                                                                                                                                                                 | `./memo.ts`, `./element.ts`, `./reconcile.ts`, `../elements/Box.js`                                                                |

---

## 5. Detailed Symbol & Contract Breakdown

### `context.ts`

#### `createContext`

- **Type / Signature:** `<T>(defaultValue: T) => Context<T>`
- **Category / Tags:** `[Pure]`
- **Description:** Constructs a context object containing a unique identifier, default fallback value, and a `Provider` component descriptor.

#### `useContext`

- **Type / Signature:** `<T>(context: Context<T>) => T`
- **Category / Tags:** `[Stateful]`
- **Description:** Reads the nearest upstream `Context.Provider` value for the requested context, falling back to `defaultValue`.

---

### `memo.ts`

#### `memo`

- **Type / Signature:** `<P = any>(component: FunctionComponent<P>, areEqual?: (prev: Readonly<P>, next: Readonly<P>) => boolean) => FunctionComponent<P>`
- **Category / Tags:** `[Pure]`
- **Description:** Wraps a function component with shallow prop comparison to skip execution when props are unchanged.

---

## 6. Lifecycle & State Machine (ASCII)

```
[reconcileInstance]
       │
       ├── Context.Provider ──► pushContextValue() ──► reconcileChildren() ──► popContextValue()
       │
       ├── memo(Component) ───► shallowEqual() ? reuse child : re-render
       │
       └── Standard Component ─► prepareToRender() ──► render() ──► finishRendering()
```

---

## 7. Security, Permissions & Error Handling

- **Scoped Context Cleanup:** Context values pushed onto the active stack are guaranteed to pop in `finally` blocks during child reconciliation, preventing context value leaks across unrelated branches.
