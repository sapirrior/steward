/** @jsxImportSource ../src */
/**
 * examples/counter.tsx
 * Interactive counter using TSX syntax, React-style hooks, and render()
 */
import { render, useState, useInput, useApp, Box, Text } from '../src/index.js';

// Subcomponent in pure TSX
function CounterHeader({ count }: { count: number }) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
      <Text bold color="green">
        Count: {count}
      </Text>
      <Text dimColor>
        Press &apos;+&apos;/Up to increment, &apos;-&apos;/Down to decrement, &apos;q&apos; to quit
      </Text>
    </Box>
  );
}

function CounterApp() {
  const [count, setCount] = useState(0);
  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key') {
      if (ev.input === 'q' || ev.input === 'Q') {
        app.exit();
        return true;
      }
      if (ev.input === '+' || ev.key.upArrow || ev.key.rightArrow) {
        setCount((c) => c + 1);
        return true;
      }
      if (ev.input === '-' || ev.key.downArrow || ev.key.leftArrow) {
        setCount((c) => c - 1);
        return true;
      }
    }
  });

  return (
    <Box flexDirection="column">
      <CounterHeader count={count} />
    </Box>
  );
}

const handle = render(<CounterApp />);
await handle.waitUntilExit();
console.log('TSX Counter application exited cleanly.');
