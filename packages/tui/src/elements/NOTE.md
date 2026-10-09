# Directory: `packages/tui/src/elements`

## 1. Overview & Single Responsibility

Implements layout rendering primitives (Box, Text, Newline, Spacer, Transform), flexbox layout mathematics, border calculation, and ANSI-colored block assembly.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
ElementNode / StitchableElement
       │
       ▼
┌───────────────────────────────┐
│       renderAnyElement        │
└──────────────┬────────────────┘
               ├── Text ──────► [ renderTextElement ] ──────► String lines + Style
               ├── Box ───────► [ renderBoxElement ] ───────► Flex math + Borders + Padding
               ├── Newline ───► [ renderNewlineElement ] ───► Blank rows
               └── Spacer ────► [ renderSpacerElement ] ────► Flex space
               │
               ▼
┌───────────────────────────────┐
│        Block { lines, width } │
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File           | Primary Responsibility                                                       | Exported Symbols                                                | Local / External Dependencies                                |
| :------------- | :--------------------------------------------------------------------------- | :-------------------------------------------------------------- | :----------------------------------------------------------- |
| `types.ts`     | Re-exports root types and defines BoxProps, TextProps, RenderContext, Block. | `BoxProps`, `TextProps`, `RenderContext`, `Block`, etc.         | `../types.js`, `../terminal/color.js`                        |
| `Box.ts`       | Layout container box rendering, flex child distribution, borders, margins.   | `Box`, `renderBoxElement`, `renderAnyElement`, `parseDimension` | `./types.js`, `./flex.js`, `./border.js`, `../text/width.js` |
| `Text.ts`      | Styled text rendering with wrapping and indentation.                         | `Text`, `renderTextElement`                                     | `./types.js`, `../text/wrap.js`, `../terminal/color.js`      |
| `Newline.ts`   | Vertical blank line spacer element.                                          | `Newline`, `renderNewlineElement`                               | `./types.js`                                                 |
| `Spacer.ts`    | Dynamic flex-expanding spacer.                                               | `Spacer`, `renderSpacerElement`                                 | `./types.js`                                                 |
| `Transform.ts` | Line-by-line output post-processing wrapper.                                 | `Transform`, `renderTransformElement`                           | `./types.js`                                                 |
| `border.ts`    | Border style glyph sets and resolution.                                      | `resolveBorderStyle`, `BORDER_STYLES`                           | `./types.js`                                                 |
| `flex.ts`      | Pure 1D flex space distribution algorithm.                                   | `distributeFlexSpace`, `computeJustifyGaps`, `alignBlockInRow`  | None                                                         |
| `style.ts`     | Style extraction and inheritance utilities.                                  | `extractTextStyle`                                              | `./types.js`                                                 |
| `elements.test.ts` | Unit tests for all declarative layout elements (Box, Text, Spacer, Newline, Transform, Fragment). | None | `./index.js`, `../reconciler/element.js` |
| `index.ts`     | Public export barrel and `renderElement` entry function.                     | `renderElement`, all element exports                            | Submodules                                                   |

---

## 5. Detailed Symbol & Contract Breakdown

### `Box.ts`

#### `renderAnyElement`

- **Type / Signature:** `(node: any, context: RenderContext) => Block`
- **Category / Tags:** `[Pure]` `[Fallible]`
- **Description:** Evaluates an `ElementNode`, string, array, or component into rendered lines and measured width. Throws descriptive error for unknown intrinsic elements.

#### `renderBoxElement`

- **Type / Signature:** `(element: StitchableElement<BoxProps>, context: RenderContext) => Block`
- **Category / Tags:** `[Pure]`
- **Description:** Calculates box sizing, padding, borders, flex distribution, background colors, and margins.

---

## 6. Lifecycle & State Machine (ASCII)

`Stateless`

```
[Input Element + Context] ──► [Measure / Distribute Flex] ──► [Render Children] ──► [Apply Borders / Padding] ──► [Emit Block]
```

---

## 7. Security, Permissions & Error Handling

- **Error Propagation:** Component errors during rendering are no longer silently suppressed into empty blocks; valid errors bubble up to error boundaries / runtime handlers.
- **Intrinsic Validation:** Rejects unrecognized intrinsic element tags with explicit diagnostics.
