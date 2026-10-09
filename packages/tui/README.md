# @steward/tui (stitchable)

`@steward/tui` (`stitchable`) is a high-performance, double-buffered terminal user interface framework for TypeScript, Bun, and Node.js. It features a lightweight, synchronous, React-style runtime and keyed reconciler with zero external React/Fiber/Yoga dependencies.

Stitchable merges reflowing scrollback history with a live differential viewport using Mode 2026 Synchronized Output for flicker-free terminal applications.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture & Layer Boundaries](#2-architecture--layer-boundaries)
3. [JSX Runtime & Intrinsic Elements](#3-jsx-runtime--intrinsic-elements)
4. [Declarative UI Components](#4-declarative-ui-components)
   - [`<Box>`](#box)
   - [`<Text>`](#text)
   - [`<Spacer>`](#spacer)
   - [`<Newline>`](#newline)
   - [`<Transform>`](#transform)
   - [`<Fragment>`](#fragment)
5. [React-Style Hooks API](#5-react-style-hooks-api)
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
7. [Context API & Memoization](#7-context-api--memoization)
   - [`createContext`](#createcontext)
   - [`memo`](#memo)
8. [Runtime & Rendering APIs](#8-runtime--rendering-apis)
   - [`render(<App />)`](#renderapp-)
   - [`createApp`](#createapp)
   - [`mount`](#mount)
   - [`renderToString`](#rendertostring)
   - [`renderStatic`](#renderstatic)
9. [Class Components & Error Boundaries](#9-class-components--error-boundaries)
10. [Styling, Color & Border Reference](#10-styling-color--border-reference)
11. [Multi-File Component Architecture](#11-multi-file-component-architecture)
12. [Architectural Invariants & Constraints](#12-architectural-invariants--constraints)

---

## 1. Quick Start

### Installation

```bash
bun add stitchable
# or
npm install stitchable
```

### TypeScript Configuration (`tsconfig.json`)

Configure your `tsconfig.json` to enable native JSX support:

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
      <Text bold color="green">
        Count: {count}
      </Text>
      <Text dimColor>
        [+] Increment · [-] Decrement · [q] Quit
      </Text>
    </Box>
  );
}

const handle = render(<CounterApp />);
await handle.waitUntilExit();
```

---

## 2. Architecture & Layer Boundaries

Stitchable enforces a strict, unidirectional layered architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ 5. APPLICATION RUNTIME & RECONCILER (runtime/, reconciler/) │
│    render, createApp, AppRoot, hooks, context, memo         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 4. DECLARATIVE ELEMENTS (src/elements/)                     │
│    Box, Text, Newline, Spacer, Transform, flex, border      │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 3. ENGINE & BUFFER PIPELINE (src/engine/, src/layout/)      │
│    TerminalEngine, DocumentTree, StateRenderer, FrameBuffer │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 1 & 2. TEXT & TERMINAL BASE (src/text/, src/terminal/)      │
│    InputParser, TerminalIO, SgrState, width, wrap, color    │
└─────────────────────────────────────────────────────────────┘
```

- **Zero React Dependency:** Custom synchronous reconciler optimized for terminal performance and $O(1)$ viewport clipping.
- **Synchronized Output:** Emits Mode 2026 escape codes (`\x1b[?2026h` ... `\x1b[?2026l`) to ensure zero-flicker terminal paints.
- **Single Persistent Input Listener:** The root application subscribes once to the engine; hooks and focus managers dispatch internally without competing event listeners.

---

## 3. JSX Runtime & Intrinsic Elements

Stitchable provides a standard JSX runtime in `stitchable/jsx-runtime` and `stitchable/jsx-dev-runtime`.

### Supported Intrinsic Tags

- `<box>` / `<Box>`: Container with flexbox layout, borders, padding, and margins.
- `<text>` / `<Text>`: Text node with word wrapping, colors, ANSI styling, and text truncation.

Both lowercase (`<box>`, `<text>`) and PascalCase (`<Box>`, `<Text>`) component tags are fully supported and interchangeable.

---

## 4. Declarative UI Components

### `<Box>`

The primary flexbox layout container.

#### Props (`BoxProps`)

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `flexDirection` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | `'row'` | Direction of flex items. |
| `flexGrow` | `number` | `0` | Flex grow factor. |
| `flexShrink` | `number` | `1` | Flex shrink factor. |
| `flexBasis` | `number \| string` | `undefined` | Initial flex main size. |
| `justifyContent` | `'flex-start' \| 'flex-end' \| 'center' \| 'space-between' \| 'space-around'` | `'flex-start'` | Distribution along the main axis. |
| `alignItems` | `'flex-start' \| 'flex-end' \| 'center' \| 'stretch'` | `'stretch'` | Alignment along the cross axis. |
| `width` | `number \| string` | `undefined` | Explicit width in columns or percentage (e.g., `'100%'`, `40`). |
| `height` | `number \| string` | `undefined` | Explicit height in rows or percentage (e.g., `'50%'`, `10`). |
| `minWidth` | `number` | `undefined` | Minimum box width in columns. |
| `maxWidth` | `number` | `undefined` | Maximum box width in columns. |
| `minHeight` | `number` | `undefined` | Minimum box height in rows. |
| `maxHeight` | `number` | `undefined` | Maximum box height in rows. |
| `borderStyle` | `'single' \| 'double' \| 'round' \| 'bold' \| 'singleDouble' \| 'doubleSingle' \| 'classic'` | `undefined` | Border style preset. |
| `borderColor` | `string` | `undefined` | Color for all four border sides (named color or hex `#rrggbb`). |
| `borderTopColor` | `string` | `undefined` | Color for the top border side. |
| `borderBottomColor` | `string` | `undefined` | Color for the bottom border side. |
| `borderLeftColor` | `string` | `undefined` | Color for the left border side. |
| `borderRightColor` | `string` | `undefined` | Color for the right border side. |
| `borderDimColor` | `boolean` | `false` | Apply dimming attribute to border glyphs. |
| `borderTop` | `boolean` | `true` (when borderStyle set) | Enable or disable the top border. |
| `borderBottom` | `boolean` | `true` (when borderStyle set) | Enable or disable the bottom border. |
| `borderLeft` | `boolean` | `true` (when borderStyle set) | Enable or disable the left border. |
| `borderRight` | `boolean` | `true` (when borderStyle set) | Enable or disable the right border. |
| `padding` | `number` | `0` | Uniform padding inside all sides. |
| `paddingX` | `number` | `0` | Horizontal padding (left and right). |
| `paddingY` | `number` | `0` | Vertical padding (top and bottom). |
| `paddingTop` | `number` | `0` | Top padding. |
| `paddingBottom` | `number` | `0` | Bottom padding. |
| `paddingLeft` | `number` | `0` | Left padding. |
| `paddingRight` | `number` | `0` | Right padding. |
| `margin` | `number` | `0` | Uniform margin outside all sides. |
| `marginX` | `number` | `0` | Horizontal margin (left and right). |
| `marginY` | `number` | `0` | Vertical margin (top and bottom). |
| `marginTop` | `number` | `0` | Top margin. |
| `marginBottom` | `number` | `0` | Bottom margin. |
| `marginLeft` | `number` | `0` | Left margin. |
| `marginRight` | `number` | `0` | Right margin. |
| `gap` | `number` | `0` | Uniform gap between children along main axis. |
| `columnGap` | `number` | `0` | Gap between columns in row direction. |
| `rowGap` | `number` | `0` | Gap between rows in column direction. |
| `backgroundColor` | `string` | `undefined` | Background fill color (named color or hex `#rrggbb`). |

---

### `<Text>`

Renders styled text with wrapping, truncation, and color support.

#### Props (`TextProps`)

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `color` | `string` | `undefined` | Foreground text color (named color or hex `#rrggbb`). |
| `backgroundColor` | `string` | `undefined` | Background text color (named color or hex `#rrggbb`). |
| `bold` | `boolean` | `false` | Bold / heavy text styling. |
| `dimColor` | `boolean` | `false` | Dim / faint text styling. |
| `italic` | `boolean` | `false` | Italic text styling. |
| `underline` | `boolean` | `false` | Underlined text. |
| `strikethrough` | `boolean` | `false` | Crossed-out / strikethrough text. |
| `inverse` | `boolean` | `false` | Invert foreground and background colors. |
| `wrap` | `'wrap' \| 'truncate' \| 'truncate-start' \| 'truncate-middle' \| 'truncate-end'` | `'wrap'` | Text wrapping and truncation strategy. |
| `hangingIndent` | `number \| string` | `0` | Hanging indentation for wrapped continuation rows. |

---

### `<Spacer>`

Fills available space along the parent's flex direction. Equivalent to `<Box flexGrow={1} />`.

```tsx
<Box flexDirection="row" width="100%">
  <Text bold>Left Title</Text>
  <Spacer />
  <Text dimColor>Right Status</Text>
</Box>
```

---

### `<Newline>`

Inserts one or more empty line breaks.

#### Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `count` | `number` | `1` | Number of empty line rows to insert. |

---

### `<Transform>`

Transforms rendered string lines of its children through a custom mapper function.

#### Props

| Prop | Type | Description |
| :--- | :--- | :--- |
| `transform` | `(line: string, index: number) => string` | Transformation function applied line-by-line. |

```tsx
<Transform transform={(line) => line.toUpperCase()}>
  <Text>this text will be transformed to uppercase</Text>
</Transform>
```

---

### `<Fragment>`

Groups multiple child elements without creating an extra container in the layout.

```tsx
import { Fragment } from 'stitchable';

function ItemList() {
  return (
    <Fragment>
      <Text>Item 1</Text>
      <Text>Item 2</Text>
    </Fragment>
  );
}
```

---

## 5. React-Style Hooks API

Stitchable provides a complete suite of standard React-style hooks with deterministic slot dispatching and batch updates.

### `useState`

```tsx
const [state, setState] = useState<S>(initialState);
```

- Supports direct values and lazy initializers (`useState(() => computeExpensiveState())`).
- Functional updates: `setState((prev) => prev + 1)`.
- Updates are automatically batched within the current microtask.

### `useReducer`

```tsx
const [state, dispatch] = useReducer(reducer, initialArg, init?);
```

- Dispatches actions through a pure reducer function `(state, action) => newState`.

### `useRef`

```tsx
const myRef = useRef<T>(initialValue);
```

- Preserves a mutable reference `{ current: T }` across re-renders without triggering re-renders on mutation.

### `useMemo`

```tsx
const memoizedValue = useMemo(() => computeValue(a, b), [a, b]);
```

- Recomputes only when values in the dependency array change (compared via `Object.is`).

### `useCallback`

```tsx
const memoizedCallback = useCallback((arg) => { ... }, [deps]);
```

- Returns a stable function reference between renders.

### `useEffect`

```tsx
useEffect(() => {
  const timer = setInterval(() => { ... }, 1000);
  return () => clearInterval(timer);
}, [deps]);
```

- Runs asynchronously after the terminal frame has been written to the output stream.
- Cleanup functions execute before the next effect or on component unmount.

### `useLayoutEffect`

```tsx
useLayoutEffect(() => {
  // Runs synchronously immediately after tree reconciliation, before next paint
}, [deps]);
```

### `useContext`

```tsx
const value = useContext(MyContext);
```

- Reads the current value from the nearest matching `MyContext.Provider` up the tree.

---

## 6. Terminal-Aware Hooks

Specialized hooks connecting components directly to terminal input, size, focus, and history.

### `useInput`

Subscribes a keyboard and paste listener to the application input dispatcher.

```tsx
useInput((event) => {
  if (event.type === 'key') {
    if (event.key.name === 'return') {
      submit();
      return true; // Return true to consume event and stop propagation
    }
  } else if (event.type === 'paste') {
    insertText(event.text);
    return true;
  }
}, { whenFocused?: boolean });
```

#### Options

- `whenFocused` (`boolean`, optional): When `true`, the input handler only triggers if the owning component currently holds logical focus (via `useFocus`).

---

### `useApp`

Returns the active application context handle.

```tsx
const app = useApp();

app.exit();        // Cleanly exit application
app.invalidate();  // Force a re-render
```

---

### `useTerminalSize`

Returns the reactive terminal dimensions.

```tsx
const { columns, rows } = useTerminalSize();
```

- Automatically re-renders the component when the user resizes their terminal window.

---

### `useFocus`

Manages logical component focus state.

```tsx
const { id, isFocused, focus, blur } = useFocus({
  id?: string,
  autoFocus?: boolean,
});
```

---

### `useCursor`

Positions the visible terminal cursor at a specific line and character offset within the rendered component.

```tsx
useCursor({
  line: 0,              // Zero-based line index in this component
  characterOffset: 5,   // Character column offset within that line
});
```

---

### `useCommitHistory`

Graduates an immutable snapshot of content into the terminal scrollback history once, leaving live dynamic components in the active frame with $O(1)$ constant rendering performance.

```tsx
const { committed } = useCommitHistory(
  <MessageBubble msg={completedMessage} />,
  [completedMessage.id, completedMessage.content],
  {
    enabled: isComplete,
    tag: 'assistant-message',
  }
);
```

---

## 7. Context API & Memoization

### `createContext`

```tsx
import { createContext, useContext } from 'stitchable';

interface ThemeContextValue {
  primary: string;
}

const ThemeContext = createContext<ThemeContextValue>({ primary: 'cyan' });

function ThemedComponent() {
  const { primary } = useContext(ThemeContext);
  return <Text color={primary}>Themed Text</Text>;
}

function Root() {
  return (
    <ThemeContext.Provider value={{ primary: '#7aa2f7' }}>
      <ThemedComponent />
    </ThemeContext.Provider>
  );
}
```

### `memo`

Wraps a function component to skip re-rendering when props have not changed (compared via shallow equality `Object.is`).

```tsx
import { memo } from 'stitchable';

export const ExpensiveMessage = memo(function Message({ text }: { text: string }) {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text>{text}</Text>
    </Box>
  );
});
```

---

## 8. Runtime & Rendering APIs

### `render(<App />)`

The primary public entrypoint for mounting and rendering applications to the terminal.

```tsx
import { render } from 'stitchable';
import { App } from './App.js';

const handle = render(<App />, {
  maxFps: 30,
  exitOnCtrlC: true,
});

await handle.waitUntilExit();
```

#### `RenderOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `io` | `TerminalIO` | `nodeIO()` | Custom terminal IO stream (e.g. `memoryIO` for tests). |
| `stdout` | `NodeJS.WriteStream` | `process.stdout` | Target stdout stream. |
| `stdin` | `NodeJS.ReadStream` | `process.stdin` | Target stdin stream. |
| `maxFps` | `number` | `30` | Maximum frame rate cap. |
| `mouse` | `boolean` | `true` | Enable SGR mouse tracking. |
| `scrollKeys` | `boolean` | `true` | Enable default PageUp/PageDown scrolling. |
| `historyLimit` | `number` | `undefined` | Maximum scrollback lines before FIFO pruning. |
| `exitOnCtrlC` | `boolean` | `true` | Automatically exit process on Ctrl+C. |
| `onError` | `(err: unknown) => void` | `undefined` | Uncaught render error handler. |

#### `RenderHandle`

- `handle.engine`: Active `TerminalEngine` instance.
- `handle.invalidate()`: Requests an immediate re-render.
- `handle.exit(errorOrValue?)`: Triggers clean application exit.
- `handle.unmount(error?)`: Synchronously unmounts components and restores terminal.
- `handle.waitUntilExit()`: Returns a `Promise<void>` resolved on exit.

---

### `createApp`

Legacy compatibility facade wrapping `mount()`.

```tsx
import { createApp, Box, Text } from 'stitchable';

const app = createApp((state, ctx) => {
  return (
    <Box>
      <Text>Count: {state.count}</Text>
    </Box>
  );
}, {
  state: { count: 0 },
});
```

---

### `renderToString`

Renders an element tree directly to an ANSI string without opening alternate screens or event loops.

```tsx
import { renderToString, Box, Text } from 'stitchable';

const ansi = renderToString(
  <Box borderStyle="round" borderColor="green" paddingX={1}>
    <Text bold color="green">SUCCESS</Text>
  </Box>,
  { columns: 40 }
);

console.log(ansi);
```

---

### `renderStatic`

Evaluates an element tree statically for history snapshot creation, enforcing hook-free pure functional evaluation.

```tsx
import { renderStatic } from 'stitchable';

const lines = renderStatic(
  <Box borderStyle="single"><Text>Static Log</Text></Box>,
  { width: 80, colorLevel: 3 }
);
```

---

## 9. Class Components & Error Boundaries

Class components extending `Component<P, S>` support lifecycle methods and error boundaries:

```tsx
import { Component, Box, Text } from 'stitchable';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: any }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Captured error in subtree:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box borderStyle="round" borderColor="red" paddingX={1}>
          <Text color="red" bold>An error occurred in this view.</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}
```

---

## 10. Styling, Color & Border Reference

### Color Palette Options

Colors can be specified in any format:
- **Named colors:** `'black'`, `'red'`, `'green'`, `'yellow'`, `'blue'`, `'magenta'`, `'cyan'`, `'white'`, `'gray'`, `'grey'`
- **Bright named colors:** `'redBright'`, `'greenBright'`, `'yellowBright'`, `'blueBright'`, `'magentaBright'`, `'cyanBright'`, `'whiteBright'`
- **Hex RGB:** `'#7aa2f7'`, `'#bb9af7'`, `'#7dcfff'`, `'#9ece6a'`, `'#e0af68'`, `'#f7768e'`
- **RGB functional:** `'rgb(122, 162, 247)'`

Colors are automatically downsampled to Truecolor (24-bit), 256 colors, or 16 ANSI colors based on terminal support.

### Border Styles

- `'single'`: `┌ ─ ┐ │ └ ─ ┘`
- `'double'`: `╔ ═ ╗ ║ ╚ ═ ╝`
- `'round'`: `╭ ─ ╮ │ ╰ ─ ╯`
- `'bold'`: `┏ ━ ┓ ┃ ┗ ━ ┛`
- `'singleDouble'`: `╓ ─ ╖ ║ ╙ ─ ╜`
- `'doubleSingle'`: `╒ ═ ╕ │ ╘ ═ ╛`
- `'classic'`: `+ - + | + - +`

---

## 11. Multi-File Component Architecture

You can structure large terminal applications across multiple files using standard TypeScript imports:

```
src/
├── components/
│   ├── ChatHeader.tsx
│   ├── MessageBubble.tsx
│   ├── InputBar.tsx
│   └── StatusFooter.tsx
├── hooks/
│   └── useDoubleCtrlCExit.ts
├── theme.ts
├── types.ts
└── App.tsx
```

---

## 12. Architectural Invariants & Constraints

1. **Rule 1 — Layer Boundaries:** Dependency flow is strictly unidirectional (`runtime` $\to$ `elements` $\to$ `engine` $\to$ `text` / `terminal`). Layer 0 files never import higher layers.
2. **Rule 2 — Zero Unnecessary Dependencies:** The only external runtime dependency is `string-width` for visual unicode width calculations.
3. **Rule 3 — Content-Blind Layout:** Layout routines never parse or guess markdown or list formatting from string contents; formatting parameters are always passed explicitly via props.
4. **Rule 5 — Single-Pass Cursor Invariant:** Cursor position calculation occurs in the exact same render pass as line layout (`renderWithCursor`), never inferred post-facto.
5. **Rule 11 — Injected Width Invariant:** Terminal column width is always passed in from the engine render loop; components never consult `process.stdout.columns` directly during rendering.

---

## License

MIT
