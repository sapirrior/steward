/** @jsxImportSource ../src */
/**
 * examples/streaming-logs.tsx
 * Real-time streaming logs using TSX syntax, React-style hooks, and render()
 */
import { render, useState, useEffect, useInput, useApp, Box, Text } from '../src/index.js';

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
            key={msg}
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

function StreamingLogsApp() {
  const [logs, setLogs] = useState<string[]>(['[INIT] System started...']);
  const [status] = useState('Streaming active');
  const app = useApp();

  useInput((ev) => {
    if (ev.type === 'key' && (ev.input === 'q' || ev.input === 'Q')) {
      app.exit();
      return true;
    }
  });

  useEffect(() => {
    let counter = 1;
    const interval = setInterval(() => {
      setLogs((prev) => {
        const next = [...prev, `[LOG #${counter++}] Data packet received at ${new Date().toLocaleTimeString()}`];
        if (next.length > 8) {
          return next.slice(next.length - 8);
        }
        return next;
      });
    }, 300);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return <LogViewer logs={logs} status={status} />;
}

const handle = render(<StreamingLogsApp />);
await handle.waitUntilExit();
console.log('Streaming logs application stopped.');
