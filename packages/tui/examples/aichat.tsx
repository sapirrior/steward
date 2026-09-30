/** @jsxImportSource ../src */
/**
 * examples/aichat.tsx
 * High-performance AI Assistant Chat using Engine Scrollback History Commits
 * 
 * Header and completed turns are committed to history once (O(1) constant paint time).
 * Only the active streaming response and input prompt live in the dynamic frame.
 */
import { createApp, Box, Text, renderElement } from '../src/index.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatState {
  model: string;
  inputText: string;
  cursorPos: number;
  isStreaming: boolean;
  streamingContent: string;
}

// Header component (committed once to history)
function ChatHeader({ model }: { model: string }) {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      width="100%"
    >
      <Text bold color="cyan">
        ⚡ Steward AI Assistant
      </Text>
      <Text dimColor>Model: {model}</Text>
      <Text bold color="green">
        ● Connected
      </Text>
    </Box>
  );
}

// Message bubble component for history and active view
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const color = isUser ? 'magenta' : 'green';
  const label = isUser ? 'You' : 'Assistant';

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      <Text bold color={color}>
        {label}:
      </Text>
      <Box borderStyle="single" borderColor={color} paddingX={1} width="100%">
        <Text>{msg.content || (isUser ? '' : '...')}</Text>
      </Box>
    </Box>
  );
}

// Full-width Input Box with Cursor Movement
function InputPrompt({
  inputText,
  cursorPos,
  isStreaming,
}: {
  inputText: string;
  cursorPos: number;
  isStreaming: boolean;
}) {
  const beforeCursor = inputText.slice(0, cursorPos);
  const cursorChar = inputText[cursorPos] || ' ';
  const afterCursor = inputText.slice(cursorPos + 1);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={isStreaming ? 'gray' : 'yellow'}
      paddingX={1}
      marginTop={1}
      width="100%"
    >
      <Text bold color={isStreaming ? 'gray' : 'yellow'}>
        {isStreaming ? 'Assistant generating response...' : 'Prompt:'}
      </Text>
      <Text color="white">
        &gt; {beforeCursor}
        <Text inverse bold color="cyan">
          {cursorChar}
        </Text>
        {afterCursor}
      </Text>
    </Box>
  );
}

// Live Dynamic View (Active Stream + Input Prompt)
function AIChatApp({ state }: { state: ChatState }) {
  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      {/* Active Streaming Response (Only rendered while generating) */}
      {state.isStreaming && (
        <MessageBubble
          msg={{
            role: 'assistant',
            content: state.streamingContent,
          }}
        />
      )}

      {/* Input Prompt Box */}
      <InputPrompt
        inputText={state.inputText}
        cursorPos={state.cursorPos}
        isStreaming={state.isStreaming}
      />

      <Text dimColor marginTop={1}>
        [Enter] Send · [←/→] Move Cursor · [Ctrl+C] Exit
      </Text>
    </Box>
  );
}

// Canned dummy responses to simulate streaming
const DUMMY_RESPONSES = [
  'I analyzed the system architecture. Completed turns and headers are committed to history scrollback and never re-wrapped.',
  'Stitchable uses double-buffering and differential ANSI rendering for flicker-free terminal UI.',
  'All background processes and terminal input listeners are cleaned up automatically on exit.',
  'Component rendering is pure and zero-allocation with stitchable createApp.',
];

let streamTimer: ReturnType<typeof setInterval> | null = null;
let responseCount = 0;

function simulateStreamingResponse(
  prompt: string,
  state: ChatState,
  engine: any,
  invalidate: () => void
) {
  state.isStreaming = true;
  state.streamingContent = '';

  const responseIndex = responseCount++ % DUMMY_RESPONSES.length;
  const fullText = `Regarding "${prompt}": ${DUMMY_RESPONSES[responseIndex]}`;
  const words = fullText.split(' ');
  let wordIdx = 0;

  streamTimer = setInterval(() => {
    if (wordIdx < words.length) {
      state.streamingContent += (wordIdx === 0 ? '' : ' ') + words[wordIdx];
      wordIdx++;
      invalidate();
    } else {
      if (streamTimer) clearInterval(streamTimer);
      streamTimer = null;

      // Commit the finished assistant response to scrollback history ONCE
      const finalMsg: Message = {
        role: 'assistant',
        content: state.streamingContent,
      };

      engine.commit(
        (width: number) =>
          renderElement(<MessageBubble msg={finalMsg} />, {
            width,
            colorLevel: engine.io.colorLevel,
          }),
        { tag: 'assistant' }
      );

      state.isStreaming = false;
      state.streamingContent = '';
      invalidate();
    }
  }, 45);
}

const app = createApp<ChatState>(
  (state) => <AIChatApp state={state} />,
  {
    state: {
      model: 'anthropic/claude-3-7-sonnet',
      inputText: '',
      cursorPos: 0,
      isStreaming: false,
      streamingContent: '',
    },
    onMount(state, ctx) {
      // 1. Commit Header to scrollback history once
      ctx.engine.commit(
        (width: number) =>
          renderElement(<ChatHeader model={state.model} />, {
            width,
            colorLevel: ctx.io.colorLevel,
          }),
        { tag: 'header' }
      );

      // 2. Commit initial Welcome Message to history
      const welcomeMsg: Message = {
        role: 'assistant',
        content:
          'Hello! I am your terminal AI assistant. Header and completed turns are committed to history scrollback with O(1) performance. Type a message below and press Enter.',
      };
      ctx.engine.commit(
        (width: number) =>
          renderElement(<MessageBubble msg={welcomeMsg} />, {
            width,
            colorLevel: ctx.io.colorLevel,
          }),
        { tag: 'welcome' }
      );

      ctx.addCleanup(() => {
        if (streamTimer) {
          clearInterval(streamTimer);
          streamTimer = null;
        }
      });
    },
    onKey(input, key, state, ctx) {
      if (key.ctrl && key.name === 'c') {
        ctx.exit();
        return;
      }

      if (state.isStreaming) {
        return; // Ignore keyboard input while streaming
      }

      // Cursor movement
      if (key.leftArrow) {
        if (state.cursorPos > 0) {
          state.cursorPos--;
          ctx.invalidate();
        }
        return;
      }

      if (key.rightArrow) {
        if (state.cursorPos < state.inputText.length) {
          state.cursorPos++;
          ctx.invalidate();
        }
        return;
      }

      if (key.home || (key.ctrl && key.name === 'a')) {
        state.cursorPos = 0;
        ctx.invalidate();
        return;
      }

      if (key.end || (key.ctrl && key.name === 'e')) {
        state.cursorPos = state.inputText.length;
        ctx.invalidate();
        return;
      }

      // Deletion
      if (key.backspace) {
        if (state.cursorPos > 0) {
          state.inputText =
            state.inputText.slice(0, state.cursorPos - 1) +
            state.inputText.slice(state.cursorPos);
          state.cursorPos--;
          ctx.invalidate();
        }
        return;
      }

      if (key.delete) {
        if (state.cursorPos < state.inputText.length) {
          state.inputText =
            state.inputText.slice(0, state.cursorPos) +
            state.inputText.slice(state.cursorPos + 1);
          ctx.invalidate();
        }
        return;
      }

      // Submit prompt
      if (key.return) {
        const text = state.inputText.trim();
        if (text.length > 0) {
          const userMsg: Message = { role: 'user', content: text };

          // Commit user message to history scrollback immediately
          ctx.engine.commit(
            (width: number) =>
              renderElement(<MessageBubble msg={userMsg} />, {
                width,
                colorLevel: ctx.io.colorLevel,
              }),
            { tag: 'user' }
          );

          state.inputText = '';
          state.cursorPos = 0;
          simulateStreamingResponse(text, state, ctx.engine, () => ctx.invalidate());
          ctx.invalidate();
        }
        return;
      }

      // Printable character typing (insert at cursor position)
      if (input && input.length === 1 && input >= ' ') {
        state.inputText =
          state.inputText.slice(0, state.cursorPos) +
          input +
          state.inputText.slice(state.cursorPos);
        state.cursorPos++;
        ctx.invalidate();
      }
    },
  }
);

await app.waitUntilExit();
console.log('AI Chat session ended.');
