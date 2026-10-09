# @steward/tui (stitchable)

`@steward/tui` (`stitchable`) is a high-performance, double-buffered terminal user interface framework for TypeScript, Bun, and Node.js. It features a lightweight, synchronous, React-style runtime and keyed reconciler with **zero external React, Fiber, or Yoga dependencies**.

Stitchable merges reflowing scrollback history with a live differential viewport using Mode 2026 Synchronized Output for **100% flicker-free** terminal applications.

---

## Table of Contents

1. [Quick Start & Installation](#1-quick-start--installation)
2. [Architecture & Engine Philosophy](#2-architecture--engine-philosophy)
3. [JSX Runtime & Intrinsic Elements](#3-jsx-runtime--intrinsic-elements)
4. [Declarative UI Components Reference](#4-declarative-ui-components-reference)
   - [`<Box>`](#box)
   - [`<Text>`](#text)
   - [`<Spacer>`](#spacer)
   - [`<Newline>`](#newline)
   - [`<Transform>`](#transform)
   - [`<Static>`](#static)
   - [`<Fragment>`](#fragment)
5. [React-Style Fundamental Hooks](#5-react-style-fundamental-hooks)
   - [`useState`](#usestate)
   - [`useReducer`](#usereducer)
   - [`useRef`](#useref)
   - [`useMemo`](#usememo)
   - [`useCallback`](#usecallback)
   - [`useEffect`](#useeffect)
   - [`useLayoutEffect`](#uselayouteffect)
   - [`useContext`](#usecontext)
6. [Terminal-Aware Hooks](#6-terminal-aware-hooks)
   - [`useInput`](#useinput)
   - [`useApp`](#useapp)
   - [`useTerminalSize`](#useterminalsize)
   - [`useFocus`](#usefocus)
   - [`useCursor`](#usecursor)
   - [`useCommitHistory`](#usecommithistory)
7. [Input & Paste Handling: The Definitive Guide](#7-input--paste-handling-the-definitive-guide)
   - [The Fast-Typing / Paste State Synchronization Gotcha](#the-fast-typing--paste-state-synchronization-gotcha)
   - [Bracketed Paste Mode & Multiline Normalization](#bracketed-paste-mode--multiline-normalization)
   - [Graceful Double-Press `Ctrl+C` Exit](#graceful-double-press-ctrlc-exit)
   - [Building a Production-Grade Text Input Bar](#building-a-production-grade-text-input-bar)
8. [Styling, Color & Border Reference](#8-styling-color--border-reference)
   - [Color Palettes & Downsampling](#color-palettes--downsampling)
   - [Background Color Cascading](#background-color-cascading)
   - [Border Styles & Individual Side Borders](#border-styles--individual-side-borders)
   - [Border Background Colors & Per-Side Dimming](#border-background-colors--per-side-dimming)
9. [Runtime & Rendering APIs](#9-runtime--rendering-apis)
   - [`render(<App />)`](#renderapp-)
   - [`renderToString`](#rendertostring)
   - [`renderStatic`](#renderstatic)
10. [Multi-File Component Architecture](#10-multi-file-component-architecture)
11. [Class Components & Error Boundaries](#11-class-components--error-boundaries)
12. [Architectural Invariants & Best Practices](#12-architectural-invariants--best-practices)

---

## 1. Quick Start & Installation

### Installation

```bash
bun add stitchable
# or
npm install stitchable
```

### TypeScript Configuration (`tsconfig.json`)

Configure your `tsconfig.json` to enable native JSX support with `stitchable` as the import source:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "stitchable"
  }
}
```

### Interactive Counter Example

```tsx
/** @jsxImportSource stitchable */
import { render, useState, useInput, useApp, Box, Text } from 'stitchable';

function CounterApp() {
  const [count, setCount] = useState(0);
  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key') {
      if (ev.input === 'q' || ev.input === 'Q') {
        app.exit();
        return true;
      }
      if (ev.input === '+' || ev.key.upArrow) {
        setCount((c) => c + 1);
        return true;
      }
      if (ev.input === '-' || ev.key.downArrow) {
        setCount((c) => c - 1);
        return true;
      }
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">Stitchable Counter</Text>
      <Text color="gray">Use +/- or Up/Down arrows to change count. Press 'q' to quit.</Text>
      <Box marginTop={1}>
        <Text>Current Count: </Text>
        <Text bold color={count >= 0 ? 'green' : 'red'}>{count}</Text>
      </Box>
    </Box>
  );
}

const handle = render(<CounterApp />);
await handle.waitUntilExit();
```

---

## 2. Architecture & Engine Philosophy

Unlike other terminal libraries that wrap Facebook's full React reconciler and compile Yoga (C++ WASM), Stitchable was architected from scratch specifically for the terminal:

1. **Alternate Screen Buffer (`\x1b[?1049h`)**:
   Terminal applications run in an isolated alternate screen buffer, protecting your shell prompt and scrollback from garbage when running or crashing.
2. **Double-Buffered Differential Screen (`ScreenBuffer` + `StateRenderer`)**:
   Every frame is rendered to an in-memory 2D cell grid. The engine diffs the active grid with the previous frame's grid and outputs only the precise changed cells using ANSI jump commands.
3. **Synchronized Output (Mode 2026)**:
   Emits `\x1b[?2026h` (begin synchronized update) and `\x1b[?2026l` (end synchronized update) around every frame write, completely eliminating tearing and flickering under high-frequency updates.
4. **Keyed Synchronous Reconciler**:
   Components run in a synchronous microtask loop. State updates are automatically coalesced (`AppScheduler`) into a single frame, preventing redundant re-renders.
5. **Pure 1D Flexbox Mathematics**:
   Fast, zero-allocation flex math handles flex-grow, flex-shrink, flex-basis, alignments, gap, margins, padding, and percentages with zero native binary overhead.

---

## 3. JSX Runtime & Intrinsic Elements

Stitchable provides a complete modern JSX runtime (`jsx-runtime` and `jsx-dev-runtime`).

You can write standard TSX / JSX elements:
```tsx
<Box flexDirection="row">
  <Text bold color="green">Success:</Text>
  <Text> Operation completed</Text>
</Box>
```

You can also use lower-case intrinsic elements interchangeably:
```tsx
<box flexDirection="column">
  <text color="yellow">Warning</text>
</box>
```

---

## 4. Declarative UI Components Reference

### `<Box>`

The fundamental layout container in Stitchable. It implements 1D CSS Flexbox, borders, padding, margins, dimensions, and backgrounds.

#### Complete Props Reference:

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`flexDirection`** | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | `'row'` | Direction to lay out child elements. |
| **`justifyContent`** | `'flex-start' \| 'flex-end' \| 'center' \| 'space-between' \| 'space-around' \| 'space-evenly'` | `'flex-start'` | How extra space is distributed along the main axis. |
| **`alignItems`** | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch'` | `'stretch'` | Cross-axis alignment for child elements. |
| **`alignSelf`** | `'auto' \| 'flex-start' \| 'center' \| 'flex-end' \| 'stretch'` | `'auto'` | Override cross-axis alignment for this specific item. |
| **`flexGrow`** | `number` | `0` | How much this item grows relative to siblings when space is available. |
| **`flexShrink`** | `number` | `1` | How much this item shrinks relative to siblings when space is constrained. |
| **`flexBasis`** | `number \| string` | `undefined` | Initial main size before flex distribution (supports percentage e.g. `'50%'`). |
| **`gap`** | `number` | `0` | Uniform gap between children in cells. |
| **`rowGap`** | `number` | `0` | Vertical gap between child rows. |
| **`columnGap`** | `number` | `0` | Horizontal gap between child columns. |
| **`width`** | `number \| string` | `undefined` | Explicit width in columns, or percentage of parent (e.g. `'100%'`). |
| **`height`** | `number \| string` | `undefined` | Explicit height in lines, or percentage of parent. |
| **`minWidth`** | `number` | `undefined` | Minimum width bound in columns. |
| **`maxWidth`** | `number` | `undefined` | Maximum width bound in columns. |
| **`minHeight`** | `number` | `undefined` | Minimum height bound in lines. |
| **`maxHeight`** | `number` | `undefined` | Maximum height bound in lines. |
| **`margin`** | `number` | `0` | Margin on all 4 sides. |
| **`marginX`** | `number` | `0` | Horizontal margin (left and right). |
| **`marginY`** | `number` | `0` | Vertical margin (top and bottom). |
| **`marginTop`** | `number` | `0` | Top margin. |
| **`marginBottom`** | `number` | `0` | Bottom margin. |
| **`marginLeft`** | `number` | `0` | Left margin. |
| **`marginRight`** | `number` | `0` | Right margin. |
| **`padding`** | `number` | `0` | Inner padding on all 4 sides. |
| **`paddingX`** | `number` | `0` | Horizontal padding (left and right). |
| **`paddingY`** | `number` | `0` | Vertical padding (top and bottom). |
| **`paddingTop`** | `number` | `0` | Top padding. |
| **`paddingBottom`** | `number` | `0` | Bottom padding. |
| **`paddingLeft`** | `number` | `0` | Left padding. |
| **`paddingRight`** | `number` | `0` | Right padding. |
| **`borderStyle`** | `'single' \| 'double' \| 'round' \| 'bold' \| 'singleDouble' \| 'doubleSingle' \| 'classic' \| BorderGlyphs` | `undefined` | Style of border to render around the box. |
| **`borderColor`** | `ColorValue` | `undefined` | Foreground color of all borders. |
| **`borderTopColor`** | `ColorValue` | `undefined` | Foreground color of the top border. |
| **`borderBottomColor`**| `ColorValue` | `undefined` | Foreground color of the bottom border. |
| **`borderLeftColor`** | `ColorValue` | `undefined` | Foreground color of the left border. |
| **`borderRightColor`**| `ColorValue` | `undefined` | Foreground color of the right border. |
| **`borderBackgroundColor`** | `ColorValue` | `undefined` | Background color of all border cells. |
| **`borderTopBackgroundColor`** | `ColorValue` | `undefined` | Background color of the top border. |
| **`borderBottomBackgroundColor`** | `ColorValue` | `undefined` | Background color of the bottom border. |
| **`borderLeftBackgroundColor`** | `ColorValue` | `undefined` | Background color of the left border. |
| **`borderRightBackgroundColor`** | `ColorValue` | `undefined` | Background color of the right border. |
| **`borderDimColor`** | `boolean` | `false` | Dim border color intensity. |
| **`borderTopDimColor`** | `boolean` | `false` | Dim top border color intensity. |
| **`borderBottomDimColor`** | `boolean` | `false` | Dim bottom border color intensity. |
| **`borderLeftDimColor`** | `boolean` | `false` | Dim left border color intensity. |
| **`borderRightDimColor`** | `boolean` | `false` | Dim right border color intensity. |
| **`borderTop`** | `boolean` | `true` | Show top border when borderStyle is set. |
| **`borderBottom`** | `boolean` | `true` | Show bottom border when borderStyle is set. |
| **`borderLeft`** | `boolean` | `true` | Show left border when borderStyle is set. |
| **`borderRight`** | `boolean` | `true` | Show right border when borderStyle is set. |
| **`backgroundColor`** | `ColorValue` | `undefined` | Background fill color for the box and its children. |
| **`overflow`** | `'visible' \| 'hidden'` | `'visible'` | Clip children exceeding box dimensions. |
| **`display`** | `'flex' \| 'none'` | `'flex'` | Hide the box and skip its rendering when set to `'none'`. |

---

### `<Text>`

Renders and styles terminal text, supporting ANSI colors, text decorations, word wrapping, truncation, and tab stop expansion.

#### Complete Props Reference:

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| **`color`** | `ColorValue` | `undefined` | Text foreground color (name, hex `#RRGGBB`, or RGB). |
| **`backgroundColor`** | `ColorValue` | *Cascaded* | Text background color. Automatically inherits from parent `<Box>` if omitted! |
| **`bold`** | `boolean` | `false` | Format text with bold weight. |
| **`dimColor`** | `boolean` | `false` | Make text less bright / dimmed. |
| **`italic`** | `boolean` | `false` | Render text in italics. |
| **`underline`** | `boolean` | `false` | Underline text. |
| **`strikethrough`** | `boolean` | `false` | Render a strikethrough line across text. |
| **`inverse`** | `boolean` | `false` | Invert foreground and background colors. |
| **`wrap`** | `'wrap' \| 'hard' \| 'truncate' \| 'truncate-start' \| 'truncate-middle' \| 'truncate-end'` | `'wrap'` | Text wrapping / clipping algorithm. |
| **`hangingIndent`** | `number \| string` | `0` | Number of columns (or prefix string) to indent wrapped continuation lines. |

#### Text Wrapping Modes:
- `'wrap'`: Standard visual word-boundary wrapping. Words are preserved intact when breaking onto new lines.
- `'hard'`: Hard grapheme wrapping. Breaks text at the exact right margin without respecting word boundaries.
- `'truncate'` / `'truncate-end'`: Truncates text exceeding available width and appends an ellipsis (`…`).
- `'truncate-start'`: Truncates text at the beginning (`…filename.ts`).
- `'truncate-middle'`: Truncates text in the middle (`start…end`).

---

### `<Spacer>`

A flexible spacer element with `flexGrow={1}`. When placed inside a row or column `<Box>`, it consumes all remaining space along the main axis to push neighboring elements apart.

```tsx
<Box flexDirection="row" width="100%">
  <Text bold color="cyan">Left Brand</Text>
  <Spacer />
  <Text color="gray">Right Status</Text>
</Box>
```

---

### `<Newline>`

Inserts one or more blank rows into text or vertical layouts without having to construct empty strings.

```tsx
<Box flexDirection="column">
  <Text>Title</Text>
  <Newline count={2} />
  <Text>Content separated by two lines</Text>
</Box>
```

---

### `<Transform>`

Transforms rendered visual string lines immediately prior to terminal blitting. Useful for uppercasing, syntax highlighting, custom string filters, or gradient post-processing.

```tsx
<Transform transform={(line) => line.toUpperCase()}>
  <Text color="cyan">all caps transformed text</Text>
</Transform>
```

---

### `<Static>`

A declarative component that permanently commits finished turns, completed jobs, or immutable logs directly into the terminal's native scrollback history.

- **Zero Viewport Clutter**: Once items are committed, they graduate out of the live differential render loop, keeping live renders $O(1)$.
- **Responsive Reflow**: If the terminal window is resized, committed history reflows cleanly without re-executing component state.
- **100% Ink Compatibility**: Drop-in compatible with Ink's `<Static items={items}>` syntax.

```tsx
function ChatHistory({ messages }: { messages: Message[] }) {
  return (
    <Static items={messages}>
      {(msg, index) => (
        <Box key={msg.id} flexDirection="column" marginTop={1}>
          <Text bold color={msg.role === 'user' ? 'blue' : 'green'}>
            {msg.role.toUpperCase()} · {msg.timestamp}
          </Text>
          <Text color="white" wrap="wrap">{msg.content}</Text>
        </Box>
      )}
    </Static>
  );
}
```

---

### `<Fragment>` / `<>...</>`

Allows grouping sibling elements without inserting a wrapper container. When placed inside a flex row `<Box>`, Stitchable automatically flattens `<Fragment>` children so they participate as direct flex items!

```tsx
function ActionButtons() {
  return (
    <>
      <Text color="green">[Enter] Submit</Text>
      <Spacer />
      <Text color="red">[Esc] Cancel</Text>
    </>
  );
}
```

---

## 5. React-Style Fundamental Hooks

Every fundamental hook in Stitchable is modularly exported and strictly follows the Rules of Hooks:

```tsx
import {
  useState,
  useReducer,
  useRef,
  useMemo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useContext,
} from 'stitchable';
```

### `useState`
```tsx
const [value, setValue] = useState<number>(0);
const [data, setData] = useState(() => expensiveInit());

setValue((prev) => prev + 1);
```

### `useReducer`
```tsx
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    default: return state;
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0 });
```

### `useRef`
```tsx
const timerRef = useRef<Timer | null>(null);
const inputBufferRef = useRef<string>('');
```

### `useMemo` & `useCallback`
```tsx
const sortedList = useMemo(() => items.slice().sort(), [items]);
const handleClick = useCallback(() => doAction(id), [id]);
```

### `useEffect` & `useLayoutEffect`
- `useLayoutEffect`: Runs synchronously immediately after component reconciliation before the frame is written to the terminal.
- `useEffect`: Runs asynchronously in the post-frame microtask queue after the screen has been updated.

```tsx
useEffect(() => {
  const timer = setInterval(() => tick(), 1000);
  return () => clearInterval(timer);
}, []);
```

### `useContext`
Subscribes to context value propagated by a parent `<Context.Provider>`.

---

## 6. Terminal-Aware Hooks

Stitchable provides first-class terminal lifecycle hooks:

### `useInput`
Listens for keyboard input, modifier keys, arrows, navigation chords, and bracketed paste events.

```tsx
useInput((ev) => {
  if (ev.type === 'key') {
    if (ev.key.ctrl && ev.key.name === 'c') {
      app.exit();
      return true; // Stop propagation
    }
    if (ev.key.return) {
      submit();
      return true;
    }
  } else if (ev.type === 'paste') {
    handlePaste(ev.text);
    return true;
  }
}, { whenFocused: true });
```

### `useApp`
Returns the application handle to exit the process cleanly, trigger explicit redraws, or access raw engine IO:

```tsx
const app = useApp();

// Exit gracefully, restoring terminal modes and raw cursor
app.exit();

// Invalidate and request immediate redraw
app.invalidate();
```

### `useTerminalSize`
Subscribes to window resize events, re-rendering with dynamic dimensions:

```tsx
const { columns, rows } = useTerminalSize();
```

### `useFocus`
Registers a logical focus node. Supports Tab navigation, autofocus, and active focus styling:

```tsx
const { id, isFocused, focus, blur } = useFocus({ autoFocus: true });

return (
  <Box borderStyle="single" borderColor={isFocused ? 'cyan' : 'gray'}>
    <Text>{isFocused ? '● Active Input' : '○ Inactive'}</Text>
  </Box>
);
```

### `useCursor`
Reports logical cursor position to the terminal hardware cursor in a single pass (`renderWithCursor`):

```tsx
useCursor({ line: 2, column: cursorPos + 2 });
```

### `useCommitHistory`
Low-level hook for graduating dynamic elements into the terminal scrollback:

```tsx
useCommitHistory(<ChatTurn turn={turn} />, [turn.id]);
```

---

## 7. Input & Paste Handling: The Definitive Guide

Handling terminal input in Node/Bun can be deceptively tricky. Here are the core patterns to build rock-solid terminal inputs with Stitchable.

### The Fast-Typing / Paste State Synchronization Gotcha

#### ⚠️ The Problem:
When a user pastes text (or types very quickly), the terminal can send dozens of characters in the exact same event loop tick. If your input handler relies solely on `cursorPos` from the component's rendered scope:

```tsx
// ❌ WRONG: Reverses pasted text!
useInput((ev) => {
  if (ev.input) {
    // cursorPos is STALE from the previous render!
    setInputText((t) => t.slice(0, cursorPos) + ev.input + t.slice(cursorPos));
    setCursorPos((p) => p + ev.input.length);
  }
});
```
When `"ABCDE"` arrives in one tick:
1. `'A'` is inserted at index 0 $\to$ text is `"A"`.
2. `'B'` is still inserted at stale index 0 $\to$ text becomes `"BA"`.
3. `'C'` is still inserted at stale index 0 $\to$ text becomes `"CBA"`.
The user's paste is **completely reversed**!

####  The Solution: Ref-Synchronized State
Maintain mutable `useRef` mirrors that update synchronously on each event:

```tsx
const [inputText, setInputText] = useState('');
const [cursorPos, setCursorPos] = useState(0);

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

    // Update ref immediately for subsequent events in the same tick
    inputTextRef.current = updated;
    cursorPosRef.current = nextPos;

    // Trigger state re-render
    setInputText(updated);
    setCursorPos(nextPos);
    return true;
  }
});
```

---

### Bracketed Paste Mode & Multiline Normalization

Stitchable automatically enables Bracketed Paste Mode (`\x1b[?2004h`) upon entry. When the user pastes:
1. All characters arrive as a single `type: 'paste'` event rather than hundreds of simulated key events.
2. If pasting multiline text into a single-line input field, newlines (`\r\n` or `\n`) must be converted to spaces; otherwise, unescaped `\n` characters might trigger your `ev.key.return` handler and auto-send mid-paste!

```tsx
useInput((ev) => {
  if (ev.type === 'paste' && ev.text) {
    // Normalize linebreaks so they don't trigger enter key auto-submits
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

### Graceful Double-Press `Ctrl+C` Exit

Standard CLI applications often require pressing `Ctrl+C` twice within a short window to prevent accidental exits:

```tsx
const lastCtrlCRef = useRef<number>(0);
const [exitWarning, setExitWarning] = useState(false);
const app = useApp();

useInput((ev) => {
  if (ev.type === 'key' && ev.key.ctrl && ev.key.name === 'c') {
    const now = Date.now();
    if (now - lastCtrlCRef.current < 800) {
      app.exit();
    } else {
      lastCtrlCRef.current = now;
      setExitWarning(true);
      setTimeout(() => setExitWarning(false), 800);
    }
    return true;
  }
});
```

---

### Building a Production-Grade Text Input Bar

Here is the complete, canonical implementation of an interactive text input with arrow navigation, Home/End, Backspace, Delete, and Paste support:

```tsx
/** @jsxImportSource stitchable */
import { Box, Text, Spacer } from 'stitchable';

interface InputBarProps {
  inputText: string;
  cursorPos: number;
  isStreaming?: boolean;
}

export function InputBar({ inputText, cursorPos, isStreaming }: InputBarProps) {
  const beforeCursor = inputText.slice(0, cursorPos);
  const cursorChar = inputText[cursorPos] || ' ';
  const afterCursor = inputText.slice(cursorPos + 1);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderLeft={false}
      borderRight={false}
      borderTop={true}
      borderBottom={true}
      borderColor={isStreaming ? 'gray' : 'cyan'}
      paddingY={0}
      width="100%"
    >
      <Box flexDirection="row" width="100%">
        <Text bold color={isStreaming ? 'gray' : 'cyan'}>
          {isStreaming ? '⚡ Processing...' : '▸ Prompt'}
        </Text>
        <Spacer />
        <Text color="gray">{inputText.length} chars</Text>
      </Box>

      <Text color="white" wrap="wrap">
        <Text color="cyan">&gt; </Text>
        {beforeCursor}
        {!isStreaming && (
          <Text inverse bold color="yellow">
            {cursorChar}
          </Text>
        )}
        {!isStreaming && afterCursor}
      </Text>
    </Box>
  );
}
```

---

## 8. Styling, Color & Border Reference

### Color Palettes & Downsampling

Stitchable supports colors in any standard format:
- **Named colors:** `'black'`, `'red'`, `'green'`, `'yellow'`, `'blue'`, `'magenta'`, `'cyan'`, `'white'`, `'gray'`
- **Bright colors:** `'redBright'`, `'greenBright'`, `'yellowBright'`, `'blueBright'`, `'cyanBright'`, etc.
- **Hex RGB:** `'#7aa2f7'`, `'#bb9af7'`, `'#7dcfff'`, `'#9ece6a'`, `'#e0af68'`
- **RGB functional:** `'rgb(122, 162, 247)'`

Colors are automatically downsampled based on terminal capabilities (Truecolor 24-bit $\to$ 256 color palette $\to$ 16 ANSI colors).

---

### Background Color Cascading

When you set `backgroundColor` on a `<Box>`, child `<Text>` elements **automatically inherit** that background color without needing to specify it on every child node:

```tsx
<Box backgroundColor="#1e1e2e" padding={1}>
  <Text color="cyan">This text automatically has a #1e1e2e background!</Text>
</Box>
```

---

### Border Styles & Individual Side Borders

Choose from built-in border styles:
- `'single'`: `┌ ─ ┐ │ └ ─ ┘`
- `'round'`: `╭ ─ ╮ │ ╰ ─ ╯`
- `'double'`: `╔ ═ ╗ ║ ╚ ═ ╝`
- `'bold'`: `┏ ━ ┓ ┃ ┗ ━ ┛`
- `'singleDouble'`: `╓ ─ ╖ ║ ╙ ─ ╜`
- `'doubleSingle'`: `╒ ═ ╕ │ ╘ ═ ╛`
- `'classic'`: `+ - + | + - +`

#### Top and Bottom Borders Only:
To render full-width dividing rules without corner artifacts:
```tsx
<Box
  borderStyle="single"
  borderLeft={false}
  borderRight={false}
  borderTop={true}
  borderBottom={true}
  borderColor="cyan"
>
  <Text>Clean horizontal rule dividers</Text>
</Box>
```

---

### Border Background Colors & Per-Side Dimming

Style border background cells and dim specific sides independently:

```tsx
<Box
  borderStyle="round"
  borderColor="cyan"
  borderBackgroundColor="#1e1e2e"
  borderTopBackgroundColor="#282a36"
  borderBottomDimColor={true}
>
  <Text>Custom border styling</Text>
</Box>
```

---

## 9. Runtime & Rendering APIs

### `render(<App />)`

Mounts a declarative component tree to the terminal and returns a control handle:

```tsx
import { render } from 'stitchable';

const handle = render(<App />, {
  maxFps: 30,          // Throttle FPS (default: 30)
  mouse: true,         // Enable mouse event tracking
  scrollKeys: true,    // Enable PageUp/PageDown scrolling
  historyLimit: 1000,  // Max lines in scrollback store
  exitOnCtrlC: true,   // Default Ctrl+C exit handler
});

// Await exit promise
await handle.waitUntilExit();
```

`handle` methods:
- `handle.exit(errorOrValue?)`: Trigger graceful unmount and resolve `waitUntilExit()`.
- `handle.unmount()`: Unmount and dispose engine immediately.
- `handle.invalidate()`: Request an immediate redraw frame.
- `handle.engine`: Direct access to underlying `TerminalEngine`.

---

### `renderToString`

Synchronously renders any component or element tree into an ANSI-formatted string without mounting to a terminal:

```tsx
import { renderToString, Box, Text } from 'stitchable';

const output = renderToString(
  <Box borderStyle="round" padding={1}>
    <Text color="green">Rendered snapshot</Text>
  </Box>,
  { columns: 80, colorLevel: 3 }
);
```

---

### `renderStatic`

Evaluates static descriptors into physical row arrays for history commits. Rejects hook calls and classes to guarantee $O(1)$ evaluation purity.

---

## 10. Multi-File Component Architecture

You can structure large terminal applications across multiple files using standard TypeScript imports:

```
src/
├── components/
│   ├── ChatHeader.tsx
│   ├── MessageBubble.tsx
│   ├── InputBar.tsx
│   ├── StatusFooter.tsx
│   └── index.ts
├── theme.ts
├── types.ts
└── index.tsx
```

### Complete Multi-File Example (`examples/multifile/`)

Run the complete multi-component terminal chat application:
```bash
bun run examples/multifile/index.tsx
```

---

## 11. Class Components & Error Boundaries

Stitchable supports Error Boundaries via standard class components with `componentDidCatch`:

```tsx
/** @jsxImportSource stitchable */
import { Component, Box, Text } from 'stitchable';

class ErrorBoundary extends Component<{ children: any }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Caught error in UI:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box borderStyle="round" borderColor="red" paddingX={1}>
          <Text color="red" bold>An unexpected error occurred in this view.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

---

## 12. Architectural Invariants & Best Practices

1. **Unidirectional Dependency Flow**: `runtime` $\to$ `elements` $\to$ `engine` $\to$ `text` / `terminal`. Internal layers never import higher layers.
2. **Zero Outer Dependencies**: Only `string-width` for visual unicode calculation. Zero Fiber, React, or Yoga dependencies.
3. **Ref-Synchronized Input Loops**: Always use mutable `useRef` mirrors when updating text input state to prevent reverse text or stale closures on fast bursts.
4. **Content-Blind Layout**: Sizing and layout are calculated strictly through props, never by parsing string contents.
5. **Single-Pass Cursor Position**: Cursor placement is resolved simultaneously with line layout, guaranteeing perfect alignment without secondary passes.

---

## License

MIT
