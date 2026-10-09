# Directory: `packages/tui/src/reconciler`

## 1. Overview & Single Responsibility

Provides declarative JSX element descriptors, child normalization, and element validation contracts for the Stitchable terminal runtime.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
TSX / JSX Syntax
       │
       ▼
┌───────────────────────────────┐
│     jsx(type, props, key)     │
└──────────────┬────────────────┘
               │ Normalizes props, extracts key, flattens children
               ▼
┌───────────────────────────────┐
│       ElementNode<P>          │ ──► [ Consumer / Reconciler / Renderer ]
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File              | Primary Responsibility                                                 | Exported Symbols                                                                             | Local / External Dependencies                                                   |
| :---------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------ |
| `element.ts`      | Factory functions for JSX element descriptors and child normalization. | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, `ELEMENT_TYPE_SYMBOL`, `isElement`, `normalizeChildren` | `../types.ts`                                                                   |
| `element.test.ts` | Targeted unit test suite for JSX descriptors and normalization.        | None (Test suite)                                                                            | `./element.ts`, `../types.ts`, `../elements/index.ts`, `../engine/Component.ts` |

---

## 5. Detailed Symbol & Contract Breakdown

### `element.ts`

#### `jsx`

- **Type / Signature:** `<P = any>(type: ElementType<P> | string, rawProps?: Record<string, unknown> | null, keyOverride?: ElementKey) => ElementNode<P>`
- **Category / Tags:** `[Pure]`
- **Description:** Produces an immutable `ElementNode` descriptor without evaluating component functions or constructing class instances.

#### `isElement`

- **Type / Signature:** `(value: unknown) => value is ElementNode`
- **Category / Tags:** `[Pure]`
- **Description:** Type guard checking whether a value is a valid `ElementNode` matching `ELEMENT_TYPE_SYMBOL`.

#### `normalizeChildren`

- **Type / Signature:** `(children: unknown) => readonly ElementChild[]`
- **Category / Tags:** `[Pure]`
- **Description:** Filters booleans, null, and undefined while recursively flattening nested child arrays.

---

## 6. Lifecycle & State Machine (ASCII)

`Stateless`

```
[JSX Call] ──► [Extract Key & Props] ──► [Normalize Children] ──► [Return ElementNode]
```

---

## 7. Security, Permissions & Error Handling

- **Tag Validation:** Unknown intrinsic tags (strings other than `box` / `text`) are accepted at descriptor generation but rejected with descriptive errors during rendering/reconciliation.
- **Pure Transformations:** Child normalization and descriptor creation perform zero side-effects and zero I/O.
