# Directory: `packages/tui/src/engine`

## 1. Overview & Single Responsibility

Core terminal rendering engine, Mode 2026 synchronized screen updates, frame double-buffering, history stores, layout measurement, and the base `Component` class.

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Component.renderWithCursor() ──► lines + cursor
              │
              ▼
┌───────────────────────────────┐
│        DocumentTree           │ ──► Responsive History & Live Nodes
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│        FrameBuffer            │ ──► computeDocumentFrame()
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│        StateRenderer          │ ──► Diff double-buffer & emit Mode 2026 ANSI
└─────────────┬─────────────────┘
              │
              ▼
┌───────────────────────────────┐
│        TerminalEngine         │ ──► Synchronized writes via TerminalIO
└───────────────────────────────┘
```

---

## 4. File Index & Responsibility Matrix

| File                    | Primary Responsibility                                                             | Exported Symbols                                    | Local / External Dependencies                                        |
| :---------------------- | :--------------------------------------------------------------------------------- | :-------------------------------------------------- | :------------------------------------------------------------------- |
| `Component.ts`          | Base UI component class with state caching, cursor reporting, and lifecycle hooks. | `Component`                                         | `./TerminalEngine.js`                                                |
| `TerminalEngine.ts`     | Engine orchestrator, frame throttling (maxFps), resize handling, input routing.    | `TerminalEngine`, `EngineOptions`                   | `./StateRenderer.js`, `./DocumentTree.js`, `../terminal/io.js`, etc. |
| `StateRenderer.ts`      | Double-buffered diff renderer using Mode 2026 synchronized terminal updates.       | `StateRenderer`                                     | `../layout/ScreenBuffer.js`, `../terminal/sequences.js`              |
| `FrameBuffer.ts`        | Frame computation from live/history document tree.                                 | `computeDocumentFrame`, `DocumentFrame`             | `./DocumentTree.js`                                                  |
| `DocumentTree.ts`       | Document hierarchy with responsive text and history nodes.                         | `DocumentTree`, `TextNode`, `ResponsiveHistoryNode` | `./HistoryStore.js`, `./HistoryLayoutCache.js`                       |
| `HistoryStore.ts`       | In-memory line history storage and truncation.                                     | `HistoryStore`                                      | None                                                                 |
| `HistoryLayoutCache.ts` | Width-keyed cache for reflowing responsive history entries.                        | `HistoryLayoutCache`                                | None                                                                 |
| `layout.ts`             | Node measurement and visual column cursor placement.                               | `measureNode`, `visibleColumnAtOffset`              | `../text/wrap.js`, `../text/width.js`                                |
| `scroll.ts`             | Virtual viewport scroll offset calculator and snapshot model.                      | `ScrollModel`                                       | None                                                                 |

---

## 5. Detailed Symbol & Contract Breakdown

### `Component.ts`

#### `Component`

- **Type / Signature:** `class Component<Props = any, State = any>`
- **Category / Tags:** `[Stateful]`
- **Description:** Abstract UI unit defining props/state, single-pass `renderWithCursor`, lifecycle hooks (`componentDidMount`, `componentDidUpdate`, `componentWillUnmount`), and error boundary protocols (`componentDidCatch`, `getDerivedStateFromError`).

---

## 6. Lifecycle & State Machine (ASCII)

```
[Instantiate Component] ──► [mount()] ──► componentDidMount()
                                                │
                                                ▼
  [setState() / markDirty()] ──► requestFrame() ──► renderWithCursor() ──► componentDidUpdate()
                                                │
                                                ▼ (on unmount)
                                    componentWillUnmount()
```

---

## 7. Security, Permissions & Error Handling

- **Architectural Boundary Invariant:** Modules in `src/engine/*` must never import `src/runtime/*` or `src/elements/*`.
- **Fault Containment:** Render execution is wrapped by frame diffing to ensure terminal escape sequences remain paired and terminal state is not corrupted.
