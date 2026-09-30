/** @jsxImportSource ../src */
/**
 * examples/counter.tsx
 * Interactive counter using TSX syntax and createApp()
 */
import { createApp, Box, Text } from '../src/index.js';

interface CounterState {
  count: number;
}

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

const app = createApp<CounterState>(
  (state) => {
    return (
      <Box flexDirection="column">
        <CounterHeader count={state.count} />
      </Box>
    );
  },
  {
    state: { count: 0 },
    onKey(input, key, state, ctx) {
      if (input === 'q' || input === 'Q') {
        ctx.exit();
        return;
      }

      if (input === '+' || key.upArrow || key.rightArrow) {
        state.count++;
        ctx.invalidate();
      } else if (input === '-' || key.downArrow || key.leftArrow) {
        state.count--;
        ctx.invalidate();
      }
    },
  }
);

await app.waitUntilExit();
console.log('TSX Counter application exited cleanly.');
