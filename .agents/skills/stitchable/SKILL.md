---
name: stitchable
description: 'Authoritative guide for building Terminal User Interfaces using Steward TUI (`stitchable` / `@steward/tui`). Use when building, debugging, refactoring, or testing terminal UI components, layout structures, text rendering, keyboard/mouse input handling, bracketed paste, scrollback history, or streaming chat interfaces in Steward.'
---

# Stitchable (`@steward/tui`) — The Definitive Engineering & Usage Manual

`stitchable` (`@steward/tui`) is a zero-dependency, double-buffered terminal user interface framework for TypeScript, Bun, and Node.js. It features a synchronous React-style runtime and keyed reconciler with **zero external React, Fiber, or Yoga dependencies**.

It guarantees **100% flicker-free terminal rendering** via differential 2D cell diffing and Mode 2026 Synchronized Output (`CSI ?2026h` / `CSI ?2026l`).

---

## 1. Quick Start & Setup

### Import & JSX Pragma
In any component file, specify the JSX import source:

```tsx
/** @jsxImportSource stitchable */
import { render, useState, useInput, useApp, Box, Text, Spacer } from 'stitchable';

function Counter() {
  const [count, setCount] = useState(0);
  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key') {
      if (ev.input === 'q' || (ev.key.ctrl && ev.key.name === 'c')) {
        app.exit();
        return true;
      }
      if (ev.key.upArrow || ev.input === '+') {
        setCount((c) => c + 1);
        return true;
      }
      if (ev.key.downArrow || ev.input === '-') {
        setCount((c) => c - 1);
        return true;
      }
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="cyan">Stitchable Counter</Text>
      <Box marginTop={1}>
        <Text>Count: </Text>
        <Text bold color={count >= 0 ? 'green' : 'red'}>{count}</Text>
      </Box>
    </Box>
  );
}

const handle = render(<Counter />);
await handle.waitUntilExit();
```

---

## 2. Core Elements Catalog

### `<Box>`
The foundational layout container implementing 1D flexbox, borders, dimensions, padding, margins, and backgrounds.

```tsx
<Box
  flexDirection="column" // 'row' | 'column' | 'row-reverse' | 'column-reverse'
  justifyContent="flex-start" // 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  alignItems="stretch" // 'flex-start' | 'center' | 'flex-end' | 'stretch'
  flexGrow={1}
  flexShrink={0}
  width="100%" // number | percentage string (e.g. '100%', '50%')
  height={10}
  gap={1}
  paddingX={2}
  paddingY={1}
  marginX={1}
  borderStyle="round" // 'single' | 'double' | 'round' | 'bold' | 'classic'
  borderColor="cyan"
  backgroundColor="#1e1e2e" // Background color cascades to child <Text> automatically!
  borderLeft={false} // Disable individual border sides for clean horizontal rule dividers
  borderRight={false}
>
  {children}
</Box>
```

### `<Text>`
Renders styled terminal text with color downsampling, formatting, and wrap control.

```tsx
<Text
  color="cyan" // Named ('green', 'red'), Bright ('cyanBright'), or Hex ('#7aa2f7')
  backgroundColor="#282a36" // Optional; automatically inherits from parent <Box> if omitted
  bold
  dimColor
  italic
  underline
  strikethrough
  inverse
  wrap="wrap" // 'wrap' (word boundary) | 'hard' | 'truncate' / 'truncate-end' | 'truncate-start' | 'truncate-middle'
  hangingIndent={2} // Indent continuation lines by N columns or prefix string
>
  Hello world
</Text>
```

### `<Spacer>`
Self-expanding element with `flexGrow={1}` that pushes adjacent siblings apart in rows or columns.

```tsx
<Box flexDirection="row" width="100%">
  <Text bold color="cyan">Steward CLI</Text>
  <Spacer />
  <Text color="gray">v0.37.0</Text>
</Box>
```

### `<Newline>`
Inserts blank rows into layouts without constructing empty strings:
```tsx
<Newline count={2} />
```

### `<Transform>`
Post-processes rendered text lines before final blitting:
```tsx
<Transform transform={(line) => line.toUpperCase()}>
  <Text>upper case</Text>
</Transform>
```

### `<Static>` & `useCommitHistory`
Permanently commits finished turns, jobs, or logs into the native terminal scrollback history.
- **$O(1)$ Live Viewport**: Once committed, items leave the differential render loop.
- **Reflow Support**: History reflows automatically on window resize.

```tsx
<Static items={messages}>
  {(msg) => (
    <Box key={msg.id} flexDirection="column" marginTop={1}>
      <Text bold color="blue">{msg.role.toUpperCase()}</Text>
      <Text wrap="wrap">{msg.content}</Text>
    </Box>
  )}
</Static>
```

Or via hook:
```tsx
useCommitHistory(<MessageBubble message={completedMsg} />, [completedMsg.id]);
```

---

## 3. Essential Hooks Reference

### React Fundamentals
- `useState<T>(initial)`
- `useReducer(reducer, initial)`
- `useRef<T>(initial)`
- `useMemo(() => value, [deps])`
- `useCallback(() => fn, [deps])`
- `useEffect(() => { cleanup }, [deps])` (runs post-frame microtask)
- `useLayoutEffect(() => { cleanup }, [deps])` (runs synchronously before frame blit)
- `useContext(Context)`

### Terminal-Aware Hooks
- **`useInput((event) => boolean | void, options?)`**: Listens for keys and bracketed paste.
- **`useMouse((event) => boolean | void)`**: Listens for clicks, drags, mouse wheel.
- **`useApp()`**: Provides `{ exit(err?), invalidate(), unmount() }`.
- **`useTerminalSize()`**: Returns `{ columns, rows }`.
- **`useFocus({ autoFocus? })`**: Returns `{ id, isFocused, focus(), blur() }`.
- **`useCursor({ line, column })`**: Places the hardware terminal cursor in a single pass.
- **`useCommitHistory(element, deps, options?)`**: Commits static elements to scrollback.

---

## 4. Critical Input & State Synchronization Gotchas

### ⚠️ The Fast Typing & Paste Synchronization Invariant
When rapid key events or pasted text arrive in the exact same event loop tick, closures referencing stale state will insert characters out-of-order or reverse strings.

**The Golden Rule**: Always maintain mutable `useRef` mirrors that update synchronously inside `useInput`:

```tsx
const [inputText, setInputText] = useState('');
const [cursorPos, setCursorPos] = useState(0);

// Synchronous ref mirrors
const inputTextRef = useRef(inputText);
inputTextRef.current = inputText;
const cursorPosRef = useRef(cursorPos);
cursorPosRef.current = cursorPos;

useInput((ev) => {
  if (ev.type === 'key' && ev.input) {
    const pos = cursorPosRef.current;
    const current = inputTextRef.current;
    const updated = current.slice(0, pos) + ev.input + current.slice(pos);
    const nextPos = pos + ev.input.length;

    // 1. Synchronously update refs for subsequent events in the same tick
    inputTextRef.current = updated;
    cursorPosRef.current = nextPos;

    // 2. Schedule re-render
    setInputText(updated);
    setCursorPos(nextPos);
    return true;
  }

  if (ev.type === 'paste' && ev.text) {
    // Normalize newlines to prevent premature submits during multiline paste
    const sanitized = ev.text.replace(/\r\n|\r|\n/g, ' ');
    const pos = cursorPosRef.current;
    const current = inputTextRef.current;
    const updated = current.slice(0, pos) + sanitized + current.slice(pos);
    const nextPos = pos + sanitized.length;

    inputTextRef.current = updated;
    cursorPosRef.current = nextPos;

    setInputText(updated);
    setCursorPos(nextPos);
    return true;
  }
});
```

---

## 5. Architectural Invariants for Steward TUI

1. **Alternate Screen Isolation**: Always run in alternate screen buffer to protect user terminal scrollback.
2. **Width is Injected**: Never call `process.stdout.columns` inside render loops; width is injected by the engine.
3. **No Direct `process.stdout.write`**: Writing directly to `stdout` bypasses Mode 2026 Synchronized Output and breaks double-buffering.
4. **Single-Pass Cursor Position**: The hardware cursor position must be reported via `useCursor` or derived alongside visual layout to prevent misalignment.
