# @steward/tui (stitchable)

`@steward/tui` (`stitchable`) is a zero-dependency (except `string-width`), double-buffered terminal user interface and layout engine for TypeScript and Bun/Node.js. It stitches responsive, reflowing scrollback history with a live differential viewport using Mode 2026 Synchronized Output for flicker-free terminal applications.

---

## Table of Contents

- [Package Architecture & Boundaries](#package-architecture--boundaries)
- [Module & API Breakdown](#module--api-breakdown)
  - [1. Terminal IO, Sequences & Input Parsing (`src/terminal/`)](#1-terminal-io-sequences--input-parsing-srcterminal)
  - [2. Text Measurement, Wrapping & ANSI Parsing (`src/text/`)](#2-text-measurement-wrapping--ansi-parsing-srctext)
  - [3. Layout, Diffing & Rendering Engine (`src/engine/` & `src/layout/`)](#3-layout-diffing--rendering-engine-srcengine--srclayout)
  - [4. Declarative Elements & Layout Primitives (`src/elements/`)](#4-declarative-elements--layout-primitives-srcelements)
  - [5. Application Runtime & Mounting (`src/runtime/`)](#5-application-runtime--mounting-srcruntime)
- [Architectural Invariants & Constraints](#architectural-invariants--constraints)

---

## Package Architecture & Boundaries

`@steward/tui` is structured into strictly isolated internal layers with one-way dependency boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│ 5. RUNTIME (src/runtime/)                                   │
│    createApp, mount, renderToString                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. DECLARATIVE ELEMENTS (src/elements/)                     │
│    Box, Text, Newline, Spacer, Transform, flex/border layout │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. ENGINE & BUFFER PIPELINE (src/engine/, src/layout/)      │
│    TerminalEngine, DocumentTree, StateRenderer, FrameBuffer │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 1 & 2. TEXT & TERMINAL BASE (src/text/, src/terminal/)      │
│    InputParser, TerminalIO, SgrState, width/wrap/sanitize   │
└─────────────────────────────────────────────────────────────┘
```

- **Zero Framework Reconcilers:** No virtual DOM or React fibers; component updates mark dirty flags and trigger batched differential renders.
- **Strict Boundary Guard:** Layer 0 (`engine/`, `layout/`) cannot import from Layer 1 (`elements/`) or Layer 2 (`runtime/`). `src/terminal/` imports nothing outside `src/terminal/`.
- **Mode 2026 Synchronized Output:** Emits atomic frame updates wrapped in `\x1b[?2026h` ... `\x1b[?2026l` to prevent terminal tearing.

---

## Module & API Breakdown

### 1. Terminal IO, Sequences & Input Parsing (`src/terminal/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/terminal/io.ts` | `TerminalIO` | `Interface` | Abstract stream and TTY interface decoupling the engine from process globals. | Defines `write`, `onData`, `columns`, `rows`, `setRawMode`, `isTTY`, `dispose`. |
| `src/terminal/io.ts` | `nodeIO` | `(stdin?, stdout?) => TerminalIO` | Production TTY IO wrapper around standard Node/Bun streams. | Employs `StringDecoder('utf8')` to prevent split multibyte/emoji byte streams. |
| `src/terminal/io.ts` | `memoryIO` | `(opts?) => MemoryIO` | In-memory mock IO for unit tests, headless goldens, and benchmarking. | Supports simulated input injection, programmatic resize, and written byte log. |
| `src/terminal/sequences.ts` | Escape Constants | `Constant` | Named ANSI/VT escape sequences for synchronized rendering, mouse, paste, and screen buffers. | Contains `SYNC_START`, `SYNC_END`, `ALT_SCREEN_ENTER`, `ALT_SCREEN_LEAVE`, `BRACKETED_PASTE_ENTER`, `BRACKETED_PASTE_LEAVE`, `MOUSE_TRACK_ENABLE`, `MOUSE_TRACK_DISABLE`. |
| `src/terminal/color.ts` | `color` / `styleText` | Functions | Zero-dependency ANSI SGR color styling supporting Truecolor (24-bit), 256 colors, and 16 ANSI colors. | Automatically downsamples colors when terminal capabilities are constrained; respects `NO_COLOR` and `FORCE_COLOR`. |
| `src/terminal/input.ts` | `InputParser` | `Class` | Stateful parser for standard VT/xterm input sequences, bracketed paste, SGR mouse tracking, and Unicode. | Implements 50ms ESC timeout disambiguation, 500ms paste fallback flush, non-BMP UTF-16 surrogate buffering, and atomic paste events (`feed`, `flush`, `flushPaste`, `reset`). |
| `src/terminal/input.ts` | `toInputEvent` | `(ev: TerminalEvent) => InputEvent \| null` | Converts raw TerminalEvents into safe typed InputEvents (returns null for mouse/focus). | Maps paste events with atomic text and key descriptor; guarantees non-null key on all listener events. |
| `src/terminal/input.ts` | `parseInputChunk` | `(chunk: string \| Buffer \| InputEvent \| TerminalEvent) => InputEvent[]` | Helper converting raw chunks or structured events into discrete `InputEvent` records. | Handles legacy string chunks, Buffers, and structured events. |
| `src/terminal/input.ts` | `Key` / `InputEvent` / `TerminalEvent` | `Types / Interfaces` | Canonical event and key descriptor contracts. | `Key` provides boolean flags (`ctrl`, `meta`, `shift`, etc.); `InputEvent` is a typed union (`type: 'key' \| 'paste'`). |

---

### 2. Text Measurement, Wrapping & ANSI Parsing (`src/text/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/text/ansi.ts` | `SgrState` | `Class` | Tracks active SGR styling state (fg, bg, modifiers) across string segments. | Serializes and restores style stacks across wrapped line breaks without style leakage. |
| `src/text/ansi.ts` | `stripAnsi` | `(text: string) => string` | Zero-dependency regex-based ANSI escape stripper. | Strips CSI, OSC, and DEC private sequences. |
| `src/text/width.ts` | `visibleWidth` | `(text: string) => number` | Computes visual display column width of a string ignoring ANSI escapes. | Evaluates East Asian wide characters and grapheme clusters via `Intl.Segmenter` and `string-width`. |
| `src/text/width.ts` | `visibleColumnAtOffset` | `(text: string, charOffset: number) => number` | Computes 1-indexed display column corresponding to a logical character offset. | Skips invisible ANSI SGR escape sequences; factors double-width CJK characters. |
| `src/text/width.ts` | `expandTabs` | `(text: string, tabWidth?: number) => string` | Expands tab characters (`\t`) to alignment spaces (default: 4). | Computes column modulo to advance precisely to the next tab stop. |
| `src/text/wrap.ts` | `wrapVisualLine` | `(text, maxCols, hangingIndent?) => string[]` | Soft-wraps text to display columns with word-boundary awareness and hanging indent. | Preserves active SGR color/style across wrapped line continuations. |
| `src/text/wrap.ts` | `wrapVisualLineWithCursor` | `(text, maxCols, offset, hangingIndent?) => WrapResultWithCursor` | Simultaneously wraps text and maps a logical character cursor to its wrapped row and column. | Single-pass cursor mapping; preserves offset alignment on CRLF normalization. |
| `src/text/truncate.ts` | `truncate` | `(text, maxCols, opts?) => string` | Truncates text to fit within column constraints (`'start'`, `'middle'`, `'end'`). | Supports optional custom ellipsis (e.g. `'…'`) and preserves ANSI style boundaries. |
| `src/text/sanitize.ts` | `sanitizeLine` | `(line: string) => string` | Sanitizes control characters and non-printable escape injection attempts. | Strips dangerous OSC sequences while preserving valid SGR formatting. |

---

### 3. Layout, Diffing & Rendering Engine (`src/engine/` & `src/layout/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/engine/TerminalEngine.ts` | `TerminalEngine` | `Class` | Central orchestration engine managing IO, frame dispatch, document tree, and input listeners. | Features debounced `requestFrame()`, `flush()`, `flushInput()`, `addInputListener((ev: InputEvent) => boolean \| void)`, scroll helpers (`scrollBy`, `scrollUp`, `scrollDown`, `scrollToTop`, `scrollToBottom`), scroll key handling (PageUp/Dn, Home/End, wheel), and automatic bottom snapping. |
| `src/engine/DocumentTree.ts` | `DocumentTree` | `Class` | Maintains the hierarchical document model composed of committed history and live dynamic nodes. | Tracks `prunedRowCount`, bounds history size via `historyLimit`, and manages per-tree layout caching. |
| `src/engine/HistoryStore.ts` | `HistoryStore` | `Class` | In-memory ring buffer storing committed history entries and layout metadata. | Hard-bounded to `historyLimit` (FIFO eviction); prevents unbounded memory growth. |
| `src/engine/HistoryLayoutCache.ts` | `HistoryLayoutCache` | `Class` | Caches wrapped row layouts for static history entries keyed by width. | Purges entries on terminal width changes and dropped history node evictions. |
| `src/engine/StateRenderer.ts` | `StateRenderer` | `Class` | Double-buffered differential renderer calculating character and style cell diffs. | Emits minimal ANSI cursor positioning and color sequences wrapped in Mode 2026 sync output. |
| `src/engine/FrameBuffer.ts` | `computeDocumentFrame` | `(tree, width, height, scroll?, forceAll?, cache?, onOverflow?) => DocumentFrame` | Top-level frame computation coordinating document measurement and viewport slicing. | Slices viewport rows in $O(\text{viewport})$ time independent of total history size. |
| `src/engine/FrameBuffer.ts` | `measureDocument` | `(tree, width, forceAll?, onOverflow?) => DocumentMeasurement` | Computes physical line counts and cursor coordinates across history and live nodes. | Returns measurement summary without mutating layout state. |
| `src/engine/FrameBuffer.ts` | `sliceViewport` | `(tree, measure, width, height, scrollOffset) => DocumentFrame` | Extracts viewport lines and maps physical cursor coordinates to relative screen rows. | Clamps cursor column coordinates to `[1, width]`. |
| `src/engine/scroll.ts` | `ScrollModel` | `Class` | Pure mathematical model managing scroll state (`follow` vs `anchored` modes). | Anchors viewport to monotonic top row IDs; survives history pruning and dynamic streaming. |
| `src/engine/layout.ts` | `measureNode` | `(node, width, forceAll?, onOverflow?) => { rows, cursorWithinNode }` | Breaks logical component lines into physical rows respecting wrapping and clipping rules. | Evaluates single-pass cursor positioning and asserts row width bounds. |
| `src/engine/layout.ts` | `layoutDocument` | `(tree, width, forceAll?, cache?, onOverflow?) => CellLayoutResult` | Lays out full document tree into flat physical rows and absolute cursor position. | Used for headless full-tree measurement and layout verification. |
| `src/layout/ScreenBuffer.ts` | `ScreenBuffer` | `Class` | Flat 2D grid storing character codepoints, style IDs, and cell widths. | Employs `Uint32Array` style interning and `Uint8Array` cell widths for low heap overhead. |

---

### 4. Declarative Elements & Layout Primitives (`src/elements/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/elements/Box.ts` | `<Box>` | `Function Component` | Primary layout container supporting flexbox positioning, borders, padding, and margins. | Supports `flexDirection`, `flexGrow`, `flexShrink`, `flexBasis`, `justifyContent`, `alignItems`, and percentage dimensions. |
| `src/elements/Text.ts` | `<Text>` | `Function Component` | Text presentation component supporting styling, wrapping modes, and hanging indentation. | Supports `color`, `backgroundColor`, `bold`, `dimColor`, `italic`, `underline`, `strikethrough`, `inverse`, and `wrap`. |
| `src/elements/Newline.ts` | `<Newline>` | `Function Component` | Inserts one or more vertical blank line rows (`count?: number`). | Rendered as empty string lines in the parent flex flow. |
| `src/elements/Spacer.ts` | `<Spacer>` | `Function Component` | Flexible spacing element that expands to fill available flex space. | Equates to `<Box flexGrow={1} />`. |
| `src/elements/Transform.ts` | `<Transform>` | `Function Component` | Applies arbitrary string transformation functions across rendered child output lines. | Useful for custom masking, casing, or syntax highlighter pipelines. |
| `src/elements/flex.ts` | `computeFlexLayout` | Function | Deterministic integer flexbox layout calculator. | Implements largest remainder fractional allocation to eliminate rounding gaps. |
| `src/elements/border.ts` | `renderBorder` | Function | Draws box borders using single, double, round, bold, or custom glyph maps. | Supports individual border side colors and dimming attributes. |

---

### 5. Application Runtime & Mounting (`src/runtime/`)

| File | Export / Item | Type | Description | Key Details / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| `src/runtime/createApp.ts` | `createApp` | `<S>(renderFn, options?) => UIHandle<S>` | High-level orchestrator initializing alternate-screen UI, raw input dispatch, and event loops. | Automatically restores terminal state on exit; handles `Ctrl+C` exit signals cleanly. |
| `src/runtime/mount.ts` | `mount` | `<S>(engine, renderFn, options?) => MountedApp<S>` | Mounts a functional declarative component into an existing `TerminalEngine` instance. | Caches `renderWithCursor` across scroll frames; respects engine ownership flags. |
| `src/runtime/renderToString.ts` | `renderToString` / `renderElement` | `(element, options?) => string` | Renders a declarative element tree to a standalone ANSI string without an active engine. | Ideal for snapshot testing, CLI stdout printing, or headless generation. |
| `src/jsx-runtime.ts` | `jsx` / `jsxs` / `Fragment` | Functions | Native JSX factory enabling `@jsxImportSource stitchable` syntax. | Returns plain Element objects; requires no React dependencies. |

---

## Architectural Invariants & Constraints

1. **Rule 1 — Layer Boundaries:** Dependency flow is strictly unidirectional (`runtime` $\to$ `elements` $\to$ `engine` $\to$ `text` / `terminal`). Layer 0 files never import from Layer 1 or Layer 2.
2. **Rule 2 — Layer 0 Frozen Contract:** Files in `src/engine/` and `src/layout/` may only be modified for Reason A (terminal escape protocol), Reason B (demonstrable plain-text layout bug), or Reason C (measured render loop regression).
3. **Rule 3 — Content-Blind Layout:** Layout routines must never sniff string contents (e.g. searching for bullets or markdown tags) to infer formatting. All indentation and wrapping parameters must be passed explicitly.
4. **Rule 5 — Single-Pass Cursor Invariant:** The cursor position is derived in the exact same render pass as line generation (`renderWithCursor`), never computed post-facto with magic line offsets.
5. **Rule 11 — Injected Width Invariant:** Terminal column width is always passed in from the engine render loop; components must never consult `process.stdout.columns` directly during rendering.
