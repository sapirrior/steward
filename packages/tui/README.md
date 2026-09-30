# 🧵 stitchable

A focused, high-performance, double-buffered terminal UI engine for TypeScript and Bun/Node.js — built with zero external dependencies except `string-width`.

---

## ⚡ Key Highlights

- **The "Stitched" Architecture:** Seamlessly stitches together responsive scrollback history with a live double-buffered viewport.
- **$O(1)$ Zero-Cost History:** Past messages and headers are committed once to retained history. They cost **$0$ CPU** during streaming/typing, but automatically reflow when the terminal is resized.
- **Double-Buffered Differential Rendering:** Calculates row-level character diffs with Mode 2026 Synchronized Output for completely flicker-free terminal paints.
- **Pure Functional Element Layer:** Declarative `<Box>`, `<Text>`, `<Newline>`, `<Spacer>`, and `<Transform>` components with an integer-based flexbox layout subset.
- **Zero-Allocation Memory Safety:** No hook reconciler overhead, no microtask cascades, and no closure churn. Flat **~2 MB V8 Heap** memory profile designed for constrained environments (e.g. Android Termux, Docker, CI).
- **Zero-Dep ANSI Color Engine:** Full support for Truecolor (24-bit), 256 colors, basic 16 ANSI colors, automatic terminal color downsampling, `NO_COLOR`, and `FORCE_COLOR`.
- **First-Class TSX / JSX:** Native support for JSX syntax with `@jsxImportSource stitchable`.

---

## 🎯 When to Use What: Feature Selection Guide

`stitchable` splits terminal interfaces into two cooperating zones: **Scrollback History** and the **Live Dynamic View**.

```
┌─────────────────────────────────────────────────────────────┐
│ SCROLLBACK HISTORY (engine.commit)                          │
│ • Banners & Headers                                         │  ← Evaluated ONCE.
│ • Completed User Prompts & AI Responses                     │  ← Stays in history.
│ • Static tool results & system logs                         │  ← Zero frame overhead.
│ • Reflows on terminal resize!                               │
├─────────────────────────────────────────────────────────────┤
│ LIVE DYNAMIC VIEW (renderFn)                                │
│ • Active streaming tokens / typing animations               │  ← Evaluated on frames.
│ • Full-width input box & moving cursor                      │  ← Double-buffered diff.
│ • Spinners, progress bars, live status badges               │  ← Flicker-free paint.
└─────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| What you want to build | Recommended Feature | Why? |
| :--- | :--- | :--- |
| **Completed Chat Turns / Log Items** | `ctx.engine.commit((width) => ...)` | Avoids re-measuring and re-wrapping past messages on every frame ($O(1)$ speed). Automatically reflows on resize. |
| **App Header / Welcome Banner** | `ctx.engine.commit(...)` in `onMount` | Renders above history once and stays in scrollback without eating live viewport rows. |
| **Live Prompt Input & Moving Cursor** | Live `renderFn` with `<InputPrompt />` | Rerenders on key input with sub-millisecond differential line diffs. |
| **Real-time LLM Token Streaming** | Live `renderFn` with `state.streamingContent` | Streams token by token into the live frame; once complete, commit to history and clear live state. |
| **Background Timers & Stream Cleanups** | `ctx.addCleanup(() => clearInterval(id))` | Guarantees zero timer leaks when the user exits with `q` or `Ctrl+C`. |
| **Updating Live State** | Mutate `state` + `ctx.invalidate()` | Tells the engine to schedule a batched differential frame. Zero allocations. |

---

## 🚀 Quick Start Examples

### 1. Interactive AI Assistant Chat (`aichat.tsx`)

Demonstrates the combination of **Responsive Scrollback History** + **Live Streaming View** + **Full Cursor Navigation**:

```tsx
/** @jsxImportSource stitchable */
import { createApp, Box, Text, renderElement } from 'stitchable';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  inputText: string;
  cursorPos: number;
  isStreaming: boolean;
  streamingContent: string;
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      <Text bold color={isUser ? 'magenta' : 'green'}>
        {isUser ? 'You' : 'Assistant'}:
      </Text>
      <Box borderStyle="single" borderColor={isUser ? 'magenta' : 'green'} paddingX={1} width="100%">
        <Text>{msg.content}</Text>
      </Box>
    </Box>
  );
}

const app = createApp<ChatState>(
  (state) => (
    <Box flexDirection="column" paddingX={1} width="100%">
      {/* Active Streaming Response (only in live view while generating) */}
      {state.isStreaming && (
        <MessageBubble msg={{ role: 'assistant', content: state.streamingContent }} />
      )}

      {/* Full-width Input Box with active cursor */}
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={state.isStreaming ? 'gray' : 'yellow'}
        paddingX={1}
        marginTop={1}
        width="100%"
      >
        <Text bold color={state.isStreaming ? 'gray' : 'yellow'}>
          {state.isStreaming ? 'Assistant generating...' : 'Prompt:'}
        </Text>
        <Text color="white">
          &gt; {state.inputText.slice(0, state.cursorPos)}
          <Text inverse bold color="cyan">
            {state.inputText[state.cursorPos] || ' '}
          </Text>
          {state.inputText.slice(state.cursorPos + 1)}
        </Text>
      </Box>
    </Box>
  ),
  {
    state: {
      inputText: '',
      cursorPos: 0,
      isStreaming: false,
      streamingContent: '',
    },
    onMount(_state, ctx) {
      // 1. Commit Welcome Message to scrollback history once
      ctx.engine.commit(
        (width: number) =>
          renderElement(
            <MessageBubble msg={{ role: 'assistant', content: 'Hello! I am your terminal assistant.' }} />,
            { width }
          )
      );
    },
    onKey(input, key, state, ctx) {
      if (key.ctrl && key.name === 'c') {
        ctx.exit();
        return;
      }
      if (state.isStreaming) return;

      // Cursor movement
      if (key.leftArrow && state.cursorPos > 0) {
        state.cursorPos--;
        ctx.invalidate();
      } else if (key.rightArrow && state.cursorPos < state.inputText.length) {
        state.cursorPos++;
        ctx.invalidate();
      } else if (key.backspace && state.cursorPos > 0) {
        state.inputText = state.inputText.slice(0, state.cursorPos - 1) + state.inputText.slice(state.cursorPos);
        state.cursorPos--;
        ctx.invalidate();
      } else if (key.return && state.inputText.trim()) {
        const text = state.inputText.trim();

        // 2. Commit User message to scrollback history immediately
        ctx.engine.commit((width: number) =>
          renderElement(<MessageBubble msg={{ role: 'user', content: text }} />, { width })
        );

        state.inputText = '';
        state.cursorPos = 0;
        state.isStreaming = true;
        ctx.invalidate();

        // 3. Simulate streaming tokens, then commit assistant response
        simulateStream(text, state, ctx);
      } else if (input && input.length === 1 && input >= ' ') {
        state.inputText = state.inputText.slice(0, state.cursorPos) + input + state.inputText.slice(state.cursorPos);
        state.cursorPos++;
        ctx.invalidate();
      }
    },
  }
);

await app.waitUntilExit();
```

---

### 2. Simple Interactive Counter (`counter.tsx`)

```tsx
/** @jsxImportSource stitchable */
import { createApp, Box, Text } from 'stitchable';

const app = createApp(
  (state, _ctx) => (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="green">Count: {state.count}</Text>
      <Text dimColor>Press &apos;+&apos;/Up to increment, &apos;-&apos;/Down to decrement, &apos;q&apos; to quit</Text>
    </Box>
  ),
  {
    state: { count: 0 },
    onKey(input, key, state, ctx) {
      if (input === 'q' || input === 'Q') ctx.exit();
      if (input === '+' || key.upArrow) { state.count++; ctx.invalidate(); }
      if (input === '-' || key.downArrow) { state.count--; ctx.invalidate(); }
    },
  }
);

await app.waitUntilExit();
```

---

## 📚 API Reference

### 1. `createApp(renderFn, options)`

Orchestrates engine creation, alternate screen buffer, raw input, and lifecycle handlers.

```ts
function createApp<S extends object>(
  renderFn: (state: S, ctx: UIContext) => any,
  options?: CreateAppOptions<S>
): UIHandle<S>;
```

#### `CreateAppOptions<S>`:
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `state` | `S` | `{}` | Initial state object passed to `renderFn` and callbacks. |
| `onKey` | `(input, key, state, ctx) => void` | `undefined` | Single persistent keyboard and ANSI event listener. |
| `onMount` | `(state, ctx) => void` | `undefined` | Lifecycle hook executed once after mounting into terminal. |
| `onUnmount`| `(state) => void` | `undefined` | Lifecycle hook executed once before teardown and terminal restoration. |
| `maxFps` | `number` | `30` | Maximum frame rate throttle for batched differential diffs. |
| `exitOnCtrlC`| `boolean` | `true` | Automatically unmounts and exits cleanly when `Ctrl+C` is pressed. |
| `io` | `TerminalIO` | `nodeIO()` | Terminal IO abstraction (`nodeIO()` or `memoryIO()`). |

---

### 2. `UIContext` (`ctx`)

Passed to `renderFn`, `onKey`, and `onMount`:

| Method / Property | Type | Description |
| :--- | :--- | :--- |
| `ctx.invalidate()` | `() => void` | Marks UI dirty and schedules the next differential render frame. Zero allocations. |
| `ctx.exit(err?)` | `(err?: any) => void` | Cleanly unmounts the app, restores terminal alternate screen, and resolves `waitUntilExit()`. |
| `ctx.addCleanup(fn)` | `(fn: () => void) => void`| Registers a cleanup callback (e.g. `clearInterval`) guaranteed to run on unmount. |
| `ctx.engine` | `TerminalEngine` | Access to underlying `TerminalEngine` (for `engine.commit(...)`, scrolling, etc.). |
| `ctx.io` | `TerminalIO` | Access to terminal IO stream and column/row dimensions. |

---

### 3. Elements Layer Props

#### `<Box>` Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `flexDirection` | `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'` | Flex direction (default: `'row'`). |
| `width` / `height` | `number \| string` | Fixed terminal cells, or percentage (e.g. `'100%'`, `'50%'`). |
| `minWidth` / `maxWidth` | `number` | Width constraints in columns. |
| `flexGrow` / `flexShrink` | `number` | Flex space allocation weights. |
| `flexBasis` | `number` | Initial size before flex distribution. |
| `justifyContent` | `'flex-start' \| 'center' \| 'flex-end' \| 'space-between' \| 'space-around' \| 'space-evenly'` | Main-axis alignment. |
| `alignItems` | `'flex-start' \| 'center' \| 'flex-end' \| 'stretch'` | Cross-axis alignment. |
| `padding` / `paddingX` / `paddingY` | `number` | Inner padding in cells. |
| `margin` / `marginTop` / etc. | `number` | Outer margin spacing. |
| `gap` / `columnGap` / `rowGap` | `number` | Spacing between children. |
| `borderStyle` | `'single' \| 'double' \| 'round' \| 'bold' \| 'singleDouble' \| 'doubleSingle' \| 'classic'` | Box border style. |
| `borderColor` | `Color` | Border color (`'cyan'`, `'#ff0055'`, `'rgb(255,0,0)'`, `'ansi256(120)'`). |
| `backgroundColor` | `Color` | Background fill color (inherited by child text). |

#### `<Text>` Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `color` | `Color` | Text foreground color. |
| `backgroundColor` | `Color` | Text background color. |
| `bold` | `boolean` | Bold text (`\x1b[1m`). |
| `dimColor` / `dim` | `boolean` | Dim text (`\x1b[2m`). |
| `italic` | `boolean` | Italic text (`\x1b[3m`). |
| `underline` | `boolean` | Underline text (`\x1b[4m`). |
| `strikethrough` | `boolean` | Strikethrough text (`\x1b[9m`). |
| `inverse` | `boolean` | Invert foreground and background. |
| `wrap` | `'wrap' \| 'hard' \| 'truncate' \| 'truncate-start' \| 'truncate-middle' \| 'truncate-end'` | Text wrap and truncation strategy. |
| `hangingIndent` | `number \| string` | Hanging indent for subsequent wrapped lines. |

---

## 🛡️ Low-Level Engine (`stitchable/engine`)

For headless testing, batch rendering, or direct terminal IO:

```ts
import { TerminalEngine, Component, memoryIO, renderToString, Box, Text } from 'stitchable';

const io = memoryIO({ columns: 80, rows: 24 });
const engine = new TerminalEngine({ io, maxFps: 60 });

// Render headless string
const ansi = renderToString(
  <Box borderStyle="round" borderColor="cyan" paddingX={1}>
    <Text bold color="green">Headless Output</Text>
  </Box>,
  { columns: 40 }
);

console.log(ansi);
```

---

## 📂 Included Runnable Examples

Run directly with Bun:

```bash
# Interactive Full-Width AI Chat with Scrollback History & Cursor Navigation
bun src/packages/tui/examples/aichat.tsx

# Interactive Counter
bun src/packages/tui/examples/counter.tsx

# Real-Time Streaming Logs
bun src/packages/tui/examples/streaming-logs.tsx
```
