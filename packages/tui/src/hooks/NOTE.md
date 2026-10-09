# Directory: `packages/tui/src/hooks`

## 1. Overview & Single Responsibility

Provides single-responsibility, modular React-style hooks for component state, effects, memos, refs, contexts, and terminal-aware subscriptions (input dispatching, cursor positioning, focus management, resize monitoring, and scrollback history commit).

---

## 2. Subfolder Navigation Tree

```
.
└── [NOTE.md](./NOTE.md) (Current Folder)
```

---

## 3. Architecture & Data Flow (ASCII Graphs)

```
Function Component
       │
       ├── useState / useReducer ────► hookState.ts (slot state & scheduleUpdate)
       ├── useRef / useMemo / useCallback ──► hookState.ts (memoized cache & deps)
       ├── useEffect / useLayoutEffect ─────► hookState.ts (pendingEffects queue)
       │
       ├── useApp ──────────────────► AppContext (TerminalEngine & io)
       ├── useTerminalSize ─────────► AppContext + io.onResize
       ├── useFocus ────────────────► AppContext + InputDispatcher (focus tracking)
       ├── useInput ────────────────► AppContext + InputDispatcher (key event listener)
       ├── useCursor ───────────────► AppContext + cursorCollector (single-pass cursor)
       └── useCommitHistory ────────► AppContext + engine.commit + renderStatic
```

---

## 4. File Index & Responsibility Matrix

| File | Primary Responsibility | Exported Symbols | Local / External Dependencies |
| :--- | :--- | :--- | :--- |
| `useState.ts` | State variable allocation and setter dispatching | `useState`, `StateAction` | `../reconciler/hookState.js` |
| `useReducer.ts` | Reducer-driven state management | `useReducer`, `Reducer` | `../reconciler/hookState.js` |
| `useRef.ts` | Mutable reference container preserved across renders | `useRef`, `MutableRef` | `../reconciler/hookState.js` |
| `useMemo.ts` | Pure value memoization with dependency array checking | `useMemo` | `../reconciler/hookState.js` |
| `useCallback.ts` | Callback identity preservation with dependency checking | `useCallback` | `../reconciler/hookState.js` |
| `useEffect.ts` | Asynchronous post-frame effect scheduler | `useEffect` | `../reconciler/hookState.js` |
| `useLayoutEffect.ts` | Synchronous pre-paint effect runner | `useLayoutEffect` | `../reconciler/hookState.js` |
| `useContext.ts` | Reads nearest Context provider value | `useContext` | `../reconciler/context.js` |
| `useApp.ts` | Access to active `TerminalEngine`, IO, and application exit controls | `useApp` | `../runtime/AppContext.js` |
| `useTerminalSize.ts` | Subscribes to dynamic terminal dimensions (`columns`, `rows`) | `useTerminalSize` | `./useApp.js`, `./useState.js`, `./useEffect.js` |
| `useCursor.ts` | Single-pass logical cursor position reporting | `useCursor` | `./useApp.js` |
| `useFocus.ts` | Logical focus acquisition, blur, and active state querying | `useFocus` | `./useApp.js`, `./useState.js`, `./useEffect.js`, `./useRef.js` |
| `useInput.ts` | Registers key and bracketed paste handlers with optional focus filter | `useInput` | `./useApp.js`, `./useEffect.js`, `./useRef.js` |
| `useCommitHistory.ts` | Commits unmounted/completed UI turns to terminal scrollback history | `useCommitHistory` | `./useApp.js`, `./useLayoutEffect.js`, `../reconciler/static-render.js` |
| `index.ts` | Public export barrel for all fundamental hooks | All hooks listed above | Submodules |

---

## 5. Invariants & Rules

1. **Rules of Hooks**: Hooks must only be called at the top level of function components during active reconciliation.
2. **Deterministic Slot Order**: Every hook call resolves an indexed slot in `instance.hookSlots`. Changing call order or hook count throws a descriptive error.
3. **Pure Execution**: State updates during render are disallowed.
