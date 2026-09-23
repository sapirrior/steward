# A sub package named tui for Steward for rendering terminal interface and layout engine

This package implements a state-driven, flicker-free, mouse-free terminal rendering engine, physical cell layout calculation, differential line updates, theme tokens, and JSX rendering primitives for Steward.

---

## File & Function Breakdown

### Core Modules (`src/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `index.ts` | `TerminalEngine` | Export | Coordinates alternate screen buffer, raw mode, and differential rendering. | Re-exported from `engine/TerminalEngine.js`. |
| | `Component` | Export | Base UI component class with state batching. | Re-exported from `engine/Component.js`. |
| | `DocumentTree` | Export | Ordered component tree with sticky header and scrollback. | Re-exported from `engine/DocumentTree.js`. |
| | `formatUserMessage` | Export | Formats user prompt text for tree rendering. | Re-exported from `engine/user-message.js`. |
| | `wrapLines` / `cell-layout` | Export | Unicode and ANSI-aware word wrapping and cell layout math. | Re-exported from `engine/cell-layout.js`. |
| | `applyMarkdown` | Export | Formats and converts markdown content into styled ANSI terminal lines. | Re-exported from `format/markdown.js`. |
| | `highlightCode` | Export | Syntax highlights code blocks. | Re-exported from `format/highlight.js`. |
| | `truncateToWidth` | Export | Safely truncates strings to visual cell width without cutting ANSI codes. | Re-exported from `format/truncate.js`. |
| | `setActiveTheme` / `listThemes` | Export | Active theme palette management. | Re-exported from `theme/index.js`. |

---

### Engine Modules (`engine/` Sub-directory)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `TerminalEngine.ts` | `TerminalEngine` | Class | Coordinates the alternate screen buffer (`\x1b[?1049h`), raw mode, synchronized output (Mode 2026), resize reflows, and exit cleanup. | Frozen contract. Never cleared fully except during resize. |
| `Component.ts` | `Component<Props, State>` | Class | Base class for UI components with batched frame requests and dirty-checking. | `setState()` triggers next-tick batch render. |
| `DocumentTree.ts` | `DocumentTree` | Class | Manages the ordered tree of components, sticky headers, and scrollable history entries. | Layer 0 document tree structure. |
| `StateRenderer.ts` | `StateRenderer` | Class | Line-differential renderer that rewrites only modified lines and avoids full-screen clears. | Differential ANSI emitter with visual row comparison. |
| `FrameBuffer.ts` | `computeDocumentFrame` | Function | Viewport and scroll slicing calculations. | Guarantees 1 line in `DocumentFrame` = 1 physical terminal row. |
| `HistoryStore.ts` | `HistoryStore` | Class | Retained-state memory store for committed session logs and exit-flush lines. | Thread-safe entry retention. |
| `cell-layout.ts` | `wrapLines` / `measureText` | Function | Measures graphemes and wraps lines respecting East Asian character widths. | ANSI-aware without splitting multibyte characters. |
| `user-message.ts` | `formatUserMessage` | Function | Formats user message prompts with chevron marker and visual wrapping. | Replaces domain formatter in Layer 0. |

---

### Layout & Primitives (`layout/` and `primitives/` Sub-directories)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `primitives/box.ts` | `Box` | Component | Content-blind container with borders, padding, and alignment. | Layer 1 primitive. |
| `primitives/text.ts` | `Text` | Component | Primitive text node with styling and clipping. | Layer 1 primitive. |
| `primitives/columns.ts` | `Columns` | Component | Multi-column layout primitive with fixed or flex widths. | Layer 1 primitive. |
| `primitives/divider.ts` | `Divider` | Component | Single horizontal line divider across terminal width. | Layer 1 primitive. |
| `primitives/keypress.ts` | `parseKeyInput` | Function | Normalizes raw terminal stdin bytes into semantic action events. | Handles Escape, Enter, Arrows, Backspace, Ctrl combinations. |
| `primitives/scrollbar.ts` | `Scrollbar` | Component | Visual scrollbar indicator for scrollable history regions. | Layer 1 primitive. |

---

### Theme & Styling (`theme/` and `format/` Sub-directories)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `theme/colors.ts` | `THEMES` | Export | 5 built-in theme definitions (`dark`, `light`, `dracula`, `dark-ansi`, `light-ansi`). | RGB & ANSI color palettes. |
| `theme/style.ts` | `c`, `bold`, `dim`, `italic` | Export | Semantic chalk wrappers for text, borders, accents, and status badges. | Safe for terminal output. |
| `theme/figures.ts` | `figures` | Export | Unicode and ASCII terminal glyphs (`pointerBold`, `bullet`, `tick`, `cross`, `horizontalLine`). | Unicode with graceful fallback. |
| `format/markdown.ts` | `applyMarkdown` | Function | Terminal markdown formatter for headings, lists, inline code, and blockquotes. | ANSI-rendered markdown. |
| `format/highlight.ts` | `highlightCode` | Function | CLI code syntax highlighter for fenced code blocks. | Uses `cli-highlight`. |
| `format/truncate.ts` | `truncateToWidth` | Function | Truncates text to visual cell width with optional ellipsis. | Respects ANSI sequences and wide characters. |

---

## Terminal Invariants & Safety

1. **3-Layer Architecture Enforcement (`Rules.txt`)**:
   - Layer 0 (`engine/`, `layout/`) and Layer 1 (`primitives/`) never import Layer 2 domain components (`src/app/ui/components`).
   - Layer 0 never imports Layer 1 primitives.
   - Layer 2 components never import `string-width` or `strip-ansi` directly for layout math (they must use Layer 0 layout utilities).
2. **Alternate Screen & Mouse Reporting**: Interactive mode runs inside `\x1b[?1049h` with SGR extended mouse tracking (`\x1b[?1000h\x1b[?1002h\x1b[?1006h`) for smooth mouse wheel scrolling.
3. **Synchronized Output**: Uses Mode 2026 (`\x1b[?2026h` ... `\x1b[?2026l`) to batch screen buffer flushes and eliminate render tearing.
4. **Deterministic Golden Snapshots**: All engine visual layouts are verified by headless golden snapshot tests.
