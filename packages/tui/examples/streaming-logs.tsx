/** @jsxImportSource ../src */
/**
 * examples/streaming-logs.tsx
 * Real-time streaming logs using TSX syntax and createApp()
 */
import { createApp, Box, Text } from '../src/index.js';

interface LogState {
  logs: string[];
  status: string;
}

function LogViewer({ logs, status }: { logs: string[]; status: string }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box borderStyle="single" borderColor="yellow" paddingX={1}>
        <Text bold color="yellow">
          Status: {status}
        </Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="blue"
        paddingX={1}
        marginTop={1}
      >
        <Text bold color="cyan">
          Recent Logs:
        </Text>
        {logs.map((msg, idx) => (
          <Text
            key={idx}
            dimColor={idx < logs.length - 1}
            color={idx === logs.length - 1 ? 'green' : undefined}
          >
            {msg}
          </Text>
        ))}
      </Box>
      <Text dimColor marginTop={1}>
        Press &apos;q&apos; or Ctrl+C to stop.
      </Text>
    </Box>
  );
}

const app = createApp<LogState>(
  (state) => {
    return <LogViewer logs={state.logs} status={state.status} />;
  },
  {
    state: {
      logs: ['[INIT] System started...'],
      status: 'Streaming active',
    },
    onMount(state, ctx) {
      let counter = 1;
      const interval = setInterval(() => {
        state.logs.push(`[LOG #${counter++}] Data packet received at ${new Date().toLocaleTimeString()}`);
        if (state.logs.length > 8) {
          state.logs.shift();
        }
        ctx.invalidate();
      }, 300);

      ctx.addCleanup(() => {
        clearInterval(interval);
      });
    },
    onKey(input, _key, _state, ctx) {
      if (input === 'q' || input === 'Q') {
        ctx.exit();
      }
    },
  }
);

await app.waitUntilExit();
console.log('Streaming logs application stopped.');
