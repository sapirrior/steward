# Directory: `packages/tui/src`

## 1. Overview & Single Responsibility

Root source folder for `@steward/tui` (`stitchable`), housing core terminal I/O, differential rendering engine, declarative element layout, reconciler, and application runtime.

---

## 2. Subfolder Navigation Tree

```
.
├── [NOTE.md](./NOTE.md) (Current Folder)
├── [elements/](./elements/NOTE.md) ── Declarative Box/Text layout primitives and flex distribution
├── [engine/](./engine/NOTE.md) ── State renderer, document history, frame buffer, and terminal engine
├── [layout/](./layout/NOTE.md) ── ScreenBuffer double-buffering and cell formatting
├── [reconciler/](./reconciler/NOTE.md) ── JSX element descriptors, child normalization, and future reconciliation
├── [runtime/](./runtime/NOTE.md) ── App mounting, renderToString, and application handles
├── [terminal/](./terminal/NOTE.md) ── Terminal IO, color parsing, ANSI sequences, and input parsing
└── [text/](./text/NOTE.md) ── ANSI-aware wrapping, truncation, width calculation, and sanitization
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
TSX / JSX Element Tree
       │
       ▼
┌───────────────────────────────┐
│     reconciler / element      │ ──► [ ElementNode Descriptors ]
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       elements (render)       │ ──► [ Block / Lines Calculation ]
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│       engine / Component      │ ──► [ Double-Buffer Diff Rendering (Mode 2026) ]
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                 | Primary Responsibility                                                                  | Exported Symbols                                                                                                                            | Local / External Dependencies                                  |
| :------------------- | :-------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------- |
| `types.ts`           | Dependency-neutral contracts for elements, component signatures, and nodes.             | `ElementNode`, `ElementChild`, `ElementType`, `IntrinsicType`, `FunctionComponent`, `ClassComponentType`, `ELEMENT_TYPE_SYMBOL`, `Fragment` | `./terminal/color.js`, `./engine/Component.js`                 |
| `jsx-runtime.ts`     | Production JSX import source entry point returning ElementNode descriptors.             | `jsx`, `jsxs`, `jsxDEV`, `Fragment`, `JSX`                                                                                                  | `./reconciler/element.js`, `./types.js`, `./elements/types.js` |
| `jsx-dev-runtime.ts` | Development JSX import source facade.                                                   | `*` from `jsx-runtime.js`                                                                                                                   | `./jsx-runtime.js`                                             |
| `index.ts`           | Public library entry point exporting engine, terminal, text, element, and runtime APIs. | All public engine, layout, terminal, text, element symbols                                                                                  | Submodules                                                     |
| `engine.ts`          | Subpath export for engine internals.                                                    | All engine submodules                                                                                                                       | `./engine/*`                                                   |

---

## 5. Detailed Symbol & Contract Breakdown

### `types.ts`

#### `ElementNode`

- **Type / Signature:** `interface ElementNode<P = any>`
- **Category / Tags:** `[Type / Interface]`
- **Description:** Immutable descriptor representing an element in the declarative UI tree.

#### `Fragment`

- **Type / Signature:** `const Fragment: unique symbol`
- **Category / Tags:** `[Constant]`
- **Description:** Symbol identity used for grouping multiple child elements without creating layout nodes.

---

## 6. Lifecycle & State Machine (ASCII)

`Stateless` (Composition root and entry facade)

---

## 7. Security, Permissions & Error Handling

- **Isolation:** Follows strict unidirectional layering (terminal -> text -> engine/layout -> elements/reconciler -> runtime).
