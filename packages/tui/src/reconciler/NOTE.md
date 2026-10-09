# Directory: `packages/tui/src/reconciler`

## 1. Overview & Single Responsibility

Implements declarative JSX element descriptors, synchronous keyed tree reconciliation, component instance identity preservation, class component lifecycles, and error boundary recovery for the Stitchable terminal UI runtime.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Incoming ElementTree (Next)
       │
       ├────────────────────────────────┐
       ▼                                ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│     reconcileRoot / Tree      │ │   Previous Instance Tree      │
└──────────────┬────────────────┘ └──────────────┬────────────────┘
               │                                 │
               ▼                                 ▼
      [ Key / Position Matching ] ───────────────┘
               ├── Match ──► [ Reuse Instance + Update Props / Lifecycle ]
               ├── New ────► [ Create Instance + Initial Render ]
               └── Stale ──► [ Unmount Instance + Run Teardown ]
               │
               ▼ (on descendant render fault)
      [ Error Boundary Lookup ] ──► [ getDerivedStateFromError + componentDidCatch ]
```

---

## 4. File Index & Responsibility Matrix

| File                | Primary Responsibility                                                                 | Exported Symbols                                                                             | Local / External Dependencies                                                           |
| :------------------ | :------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `element.ts`        | Factory functions for JSX element descriptors and child normalization.                 | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, `ELEMENT_TYPE_SYMBOL`, `isElement`, `normalizeChildren` | `../types.ts`                                                                           |
| `instance.ts`       | Component instance models, tags, and slot record initialization.                       | `createInstance`, `ComponentInstance`, `InstanceTag`                                         | `../types.ts`, `../engine/Component.js`                                                 |
| `reconcile.ts`      | Keyed synchronous reconciler, instance lifecycle updates, and error boundary recovery. | `reconcileRoot`, `reconcileInstance`, `unmountTree`, `unmountInstance`, `RuntimeContext`     | `./element.js`, `./instance.js`, `./errors.js`, `../types.ts`, `../engine/Component.js` |
| `errors.ts`         | Error boundary detection, diagnostic error classes, and error metadata.                | `isErrorBoundaryClass`, `ComponentRenderError`, `ErrorInfo`                                  | None                                                                                    |
| `element.test.ts`   | Unit tests for JSX descriptors and normalization.                                      | None (Test suite)                                                                            | `./element.ts`, `../types.ts`, `../elements/index.ts`, `../engine/Component.ts`         |
| `reconcile.test.ts` | Unit tests for keyed reconciliation, persistent instances, and error boundaries.       | None (Test suite)                                                                            | `./reconcile.ts`, `./element.ts`, `../engine/Component.ts`                              |

---

## 5. Detailed Symbol & Contract Breakdown

### `reconcile.ts`

#### `reconcileRoot`

- **Type / Signature:** `(previousTree: ComponentInstance | null, nextElement: ElementChild, runtime?: RuntimeContext) => ComponentInstance | null`
- **Category / Tags:** `[Pure]` `[Stateful]`
- **Description:** Reconciles the root element descriptor tree against existing instance records, reordering keyed siblings and preserving component identities.

#### `unmountTree`

- **Type / Signature:** `(root: ComponentInstance | null) => void`
- **Category / Tags:** `[Stateful]`
- **Description:** Recursively tears down an instance subtree, invoking `componentWillUnmount` on class components.

---

## 6. Lifecycle & State Machine (ASCII)

```
[reconcileInstance]
       │
       ├── First Render ──► [createInstance] ──► [render()] ──► componentDidMount() ──► [Mounted]
       │                                                                                   │
       ├── Rerender ─────► [props/state update] ──► [render()] ──► componentDidUpdate() ───┤
       │                                                                                   │
       └── Removed ──────► [unmountInstance] ──► componentWillUnmount() ──────────────► [Unmounted]
```

---

## 7. Security, Permissions & Error Handling

- **Transactional Publication:** Render-time faults in descendant trees are intercepted by ancestor error boundaries via `getDerivedStateFromError` and `componentDidCatch`. If unhandled, the error cleanly halts reconciliation without corrupting prior published state.
