/** @jsxImportSource ../src */
/**
 * examples/aichat.tsx
 * High-performance AI Assistant Chat using Declarative Hooks and useCommitHistory
 *
 * Header and completed turns are committed to history once (O(1) constant paint time).
 * Only the active streaming response and input prompt live in the dynamic frame.
 */
import {
  render,
  useState,
  useEffect,
  useInput,
  useApp,
  useCommitHistory,
  Box,
  Text,
} from '../src/index.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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

// Static Header & Welcome initializers using useCommitHistory
function ChatHistoryBootstrap({ model }: { model: string }) {
  useCommitHistory(<ChatHeader model={model} />, ['header-init'], { tag: 'header' });
  useCommitHistory(
    <MessageBubble
      msg={{
        role: 'assistant',
        content:
          'Hello! I am your terminal AI assistant. Header and completed turns are committed to history scrollback with O(1) performance. Type a message below and press Enter.',
      }}
    />,
    ['welcome-init'],
    { tag: 'welcome' },
  );

  return null;
}

// Completed Message committed to history
function CommittedTurn({ msg, id }: { msg: Message; id: string }) {
  const { committed } = useCommitHistory(<MessageBubble msg={msg} />, [id, msg.content], {
    tag: msg.role,
  });

  if (committed) {
    return null;
  }
  return <MessageBubble msg={msg} />;
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

const DUMMY_RESPONSES = [
  'I analyzed the system architecture. Completed turns and headers are committed to history scrollback and never re-wrapped.',
  'Stitchable uses double-buffering and differential ANSI rendering for flicker-free terminal UI.',
  'All background processes and terminal input listeners are cleaned up automatically on exit.',
  'Component rendering is pure and zero-allocation with stitchable render().',
];

function AIChatApp() {
  const model = 'anthropic/claude-3-7-sonnet';
  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [completedTurns, setCompletedTurns] = useState<{ msg: Message; id: string }[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);

  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key') {
      if (ev.key.ctrl && ev.key.name === 'c') {
        app.exit();
        return true;
      }

      if (isStreaming) {
        return true; // Ignore keyboard input while streaming
      }

      // Cursor movement
      if (ev.key.leftArrow) {
        if (cursorPos > 0) {
          setCursorPos((pos) => pos - 1);
        }
        return true;
      }

      if (ev.key.rightArrow) {
        if (cursorPos < inputText.length) {
          setCursorPos((pos) => pos + 1);
        }
        return true;
      }

      if (ev.key.home || (ev.key.ctrl && ev.key.name === 'a')) {
        setCursorPos(0);
        return true;
      }

      if (ev.key.end || (ev.key.ctrl && ev.key.name === 'e')) {
        setCursorPos(inputText.length);
        return true;
      }

      // Deletion
      if (ev.key.backspace) {
        if (cursorPos > 0) {
          setInputText((txt) => txt.slice(0, cursorPos - 1) + txt.slice(cursorPos));
          setCursorPos((pos) => pos - 1);
        }
        return true;
      }

      if (ev.key.delete) {
        if (cursorPos < inputText.length) {
          setInputText((txt) => txt.slice(0, cursorPos) + txt.slice(cursorPos + 1));
        }
        return true;
      }

      // Submit prompt
      if (ev.key.return) {
        const text = inputText.trim();
        if (text.length > 0) {
          const userMsg: Message = { role: 'user', content: text };
          setCompletedTurns((prev) => [
            ...prev,
            { msg: userMsg, id: `user-${Date.now()}-${prev.length}` },
          ]);
          setInputText('');
          setCursorPos(0);
          setIsStreaming(true);
          setStreamingContent('');
          setStreamIndex((i) => i + 1);
        }
        return true;
      }

      // Printable character typing
      if (!ev.key.ctrl && !ev.key.meta && ev.input && ev.input.length > 0 && ev.input >= ' ') {
        setInputText((txt) => txt.slice(0, cursorPos) + ev.input + txt.slice(cursorPos));
        setCursorPos((pos) => pos + ev.input.length);
        return true;
      }
    } else if (ev.type === 'paste' && ev.text) {
      if (!isStreaming) {
        const sanitized = ev.text.replace(/\n+/g, ' ');
        setInputText((txt) => txt.slice(0, cursorPos) + sanitized + txt.slice(cursorPos));
        setCursorPos((pos) => pos + sanitized.length);
        return true;
      }
    }
  });

  // Streaming effect
  useEffect(() => {
    if (!isStreaming) return;

    const responseIndex = (streamIndex - 1) % DUMMY_RESPONSES.length;
    const fullText = `Regarding your prompt: ${DUMMY_RESPONSES[responseIndex]}`;
    const words = fullText.split(' ');
    let wordIdx = 0;

    const interval = setInterval(() => {
      if (wordIdx < words.length) {
        const nextWord = words[wordIdx];
        setStreamingContent((prev) => (wordIdx === 0 ? nextWord : `${prev} ${nextWord}`));
        wordIdx++;
      } else {
        clearInterval(interval);
        const finalMsg: Message = { role: 'assistant', content: fullText };
        setCompletedTurns((prev) => [
          ...prev,
          { msg: finalMsg, id: `asst-${Date.now()}-${prev.length}` },
        ]);
        setIsStreaming(false);
        setStreamingContent('');
      }
    }, 45);

    return () => {
      clearInterval(interval);
    };
  }, [isStreaming, streamIndex]);

  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      <ChatHistoryBootstrap model={model} />

      {completedTurns.map((turn) => (
        <CommittedTurn key={turn.id} msg={turn.msg} id={turn.id} />
      ))}

      {/* Active Streaming Response (Only rendered while generating) */}
      {isStreaming && (
        <MessageBubble
          msg={{
            role: 'assistant',
            content: streamingContent,
          }}
        />
      )}

      {/* Input Prompt Box */}
      <InputPrompt
        inputText={inputText}
        cursorPos={cursorPos}
        isStreaming={isStreaming}
      />

      <Text dimColor marginTop={1}>
        [Enter] Send · [←/→] Move Cursor · [Ctrl+C] Exit
      </Text>
    </Box>
  );
}

const handle = render(<AIChatApp />);
await handle.waitUntilExit();
console.log('AI Chat session ended.');
