/** @jsxImportSource stitchable */
/**
 * examples/multifile/index.tsx
 * Modular multi-component real chat UI using Stitchable React-style runtime.
 */
import {
  render,
  useState,
  useRef,
  useEffect,
  useInput,
  useApp,
  useCommitHistory,
  Box,
  Static,
} from 'stitchable';


import {
  ChatHeader,
  MessageBubble,
  InputBar,
  StatusFooter,
} from './components/index.js';

import type { ChatMessage } from './types.js';

// Realistic responses to simulate assistant reasoning & code answers
const SAMPLE_RESPONSES = [
  'I have refactored the module into small, isolated component files. The layout now separates the ChatHeader, MessageBubble, and InputBar cleanly.',
  'Stitchable uses atomic reconciliation and single-pass visual layout, guaranteeing zero flicker even with high-frequency streaming tokens.',
  'All terminal events, bracketed paste streams, and alternate screen buffers are fully cleaned up when exiting the session.',
  'By leveraging `useCommitHistory`, previous conversation turns graduate to the terminal scrollback with O(1) rendering overhead.',
];

function StaticBootstrap({ model }: { model: string }) {
  useCommitHistory(<ChatHeader model={model} />, ['header-init'], { tag: 'header' });
  useCommitHistory(
    <MessageBubble
      message={{
        id: 'sys-init',
        role: 'system',
        content:
          'Steward Terminal Agent connected. Type your prompt below and press Enter.',
        timestamp: new Date().toLocaleTimeString(),
        tokens: 32,
      }}
    />,
    ['sys-init'],
    { tag: 'system' },
  );
  return null;
}

function CommittedMessageItem({ message }: { message: ChatMessage }) {
  const { committed } = useCommitHistory(
    <MessageBubble message={message} />,
    [message.id, message.content],
    { tag: message.role },
  );

  if (committed) {
    return null;
  }
  return <MessageBubble message={message} />;
}

export function ChatApp() {
  const model = 'claude-3-7-sonnet';
  const [inputText, setInputText] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);

  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const cursorPosRef = useRef(cursorPos);
  cursorPosRef.current = cursorPos;

  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key') {
      if (ev.key.ctrl && ev.key.name === 'c') {
        app.exit();
        return true;
      }

      if (isStreaming) {
        return true;
      }

      if (ev.key.leftArrow) {
        if (cursorPosRef.current > 0) {
          const next = cursorPosRef.current - 1;
          cursorPosRef.current = next;
          setCursorPos(next);
        }
        return true;
      }

      if (ev.key.rightArrow) {
        if (cursorPosRef.current < inputTextRef.current.length) {
          const next = cursorPosRef.current + 1;
          cursorPosRef.current = next;
          setCursorPos(next);
        }
        return true;
      }

      if (ev.key.home || (ev.key.ctrl && ev.key.name === 'a')) {
        cursorPosRef.current = 0;
        setCursorPos(0);
        return true;
      }

      if (ev.key.end || (ev.key.ctrl && ev.key.name === 'e')) {
        const endPos = inputTextRef.current.length;
        cursorPosRef.current = endPos;
        setCursorPos(endPos);
        return true;
      }

      if (ev.key.backspace) {
        if (cursorPosRef.current > 0) {
          const pos = cursorPosRef.current;
          const current = inputTextRef.current;
          const updated = current.slice(0, pos - 1) + current.slice(pos);
          inputTextRef.current = updated;
          cursorPosRef.current = pos - 1;
          setInputText(updated);
          setCursorPos(pos - 1);
        }
        return true;
      }

      if (ev.key.delete) {
        const pos = cursorPosRef.current;
        const current = inputTextRef.current;
        if (pos < current.length) {
          const updated = current.slice(0, pos) + current.slice(pos + 1);
          inputTextRef.current = updated;
          setInputText(updated);
        }
        return true;
      }

      if (ev.key.return) {
        const text = inputTextRef.current.trim();
        if (text.length > 0) {
          const userMsg: ChatMessage = {
            id: `usr-${Date.now()}`,
            role: 'user',
            content: text,
            timestamp: new Date().toLocaleTimeString(),
            tokens: Math.ceil(text.length / 3),
          };

          setMessages((prev) => [...prev, userMsg]);
          inputTextRef.current = '';
          cursorPosRef.current = 0;
          setInputText('');
          setCursorPos(0);
          setIsStreaming(true);
          setStreamingContent('');
          setStreamIndex((i) => i + 1);
        }
        return true;
      }

      if (!ev.key.ctrl && !ev.key.meta && ev.input && ev.input >= ' ') {
        const pos = cursorPosRef.current;
        const current = inputTextRef.current;
        const updated = current.slice(0, pos) + ev.input + current.slice(pos);
        const nextPos = pos + ev.input.length;
        inputTextRef.current = updated;
        cursorPosRef.current = nextPos;
        setInputText(updated);
        setCursorPos(nextPos);
        return true;
      }
    } else if (ev.type === 'paste' && ev.text) {
      if (!isStreaming) {
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
    }
  });

  // Simulated token streaming effect
  useEffect(() => {
    if (!isStreaming) return;

    const responseTemplate =
      SAMPLE_RESPONSES[(streamIndex - 1) % SAMPLE_RESPONSES.length];
    const words = responseTemplate.split(' ');
    let wordIdx = 0;

    const interval = setInterval(() => {
      if (wordIdx < words.length) {
        const nextWord = words[wordIdx];
        setStreamingContent((prev) => (wordIdx === 0 ? nextWord : `${prev} ${nextWord}`));
        wordIdx++;
      } else {
        clearInterval(interval);
        const asstMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: responseTemplate,
          timestamp: new Date().toLocaleTimeString(),
          tokens: Math.ceil(responseTemplate.length / 3),
        };

        setMessages((prev) => [...prev, asstMsg]);
        setIsStreaming(false);
        setStreamingContent('');
      }
    }, 40);

    return () => {
      clearInterval(interval);
    };
  }, [isStreaming, streamIndex]);

  return (
    <Box flexDirection="column" paddingX={0} width="100%">
      <StaticBootstrap model={model} />

      <Static items={messages}>
        {(msg) => <MessageBubble key={msg.id} message={msg} />}
      </Static>

      {isStreaming && (
        <MessageBubble
          message={{
            id: 'stream-live',
            role: 'assistant',
            content: streamingContent || '▋',
            timestamp: new Date().toLocaleTimeString(),
          }}
        />
      )}

      <InputBar
        inputText={inputText}
        cursorPos={cursorPos}
        isStreaming={isStreaming}
      />

      <StatusFooter totalMessages={messages.length} />
    </Box>
  );
}

// Start application
const handle = render(<ChatApp />);
await handle.waitUntilExit();
console.log('Chat session closed.');
