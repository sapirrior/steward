import { useState, useCallback, useRef } from 'stitchable';
import { Box, Static } from 'stitchable';
import { Header } from './components/Header.js';
import { PromptInput } from './components/PromptInput.js';
import { TurnView, type ChatTurn } from './components/TurnView.js';
import { runBash } from '../services/basher/bashRunner.js';

export interface AppProps {
  version: string;
  provider: string;
  model: string;
  cwd: string;
  reasoningEffort?: string;
}

export function App({
  version,
  provider,
  model,
  cwd,
  reasoningEffort,
}: AppProps) {
  // 1. Permanent startup items to commit directly to terminal scrollback
  const staticItems = [
    {
      id: 'header',
      version,
      provider,
      model,
      cwd,
      reasoningEffort,
    },
  ];

  // 2. Completed turns committed to scrollback
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  // 3. Currently active streaming turn in the live differential viewport
  const [activeTurn, setActiveTurn] = useState<ChatTurn | null>(null);

  const handleSubmit = useCallback(
    async (value: string, mode: 'prompt' | 'bash') => {
      const turnId = `turn-${Date.now()}`;

      if (mode === 'bash') {
        const initialTurn: ChatTurn = {
          id: turnId,
          userPrompt: value,
          isBash: true,
          toolCalls: [
            {
              id: `call-${turnId}`,
              name: 'bash',
              input: { command: value },
              status: 'running',
            },
          ],
        };

        setActiveTurn(initialTurn);

        try {
          const result = await runBash(value, { cwd });
          const finishedTurn: ChatTurn = {
            ...initialTurn,
            assistantContent: result.combined ? result.combined.trim() : undefined,
            toolCalls: [
              {
                id: `call-${turnId}`,
                name: 'bash',
                input: { command: value },
                status: result.exitCode === 0 ? 'success' : 'error',
                output: result.combined,
                error: result.exitCode !== 0 ? `Exit code ${result.exitCode}` : undefined,
              },
            ],
          };

          setTurns((prev) => [...prev, finishedTurn]);
        } catch (err: any) {
          const errorTurn: ChatTurn = {
            ...initialTurn,
            toolCalls: [
              {
                id: `call-${turnId}`,
                name: 'bash',
                input: { command: value },
                status: 'error',
                error: err.message || 'Execution failed',
              },
            ],
          };
          setTurns((prev) => [...prev, errorTurn]);
        } finally {
          setActiveTurn(null);
        }
        return;
      }

      // Prompt mode
      const promptTurn: ChatTurn = {
        id: turnId,
        userPrompt: value,
        isBash: false,
        assistantContent: '',
        toolCalls: [],
      };

      setActiveTurn(promptTurn);

      // Will be connected to SDK stream in the next step
      // For now, commit prompt response
      const finishedTurn: ChatTurn = {
        ...promptTurn,
        assistantContent: `Received prompt: ${value}`,
      };
      setTurns((prev) => [...prev, finishedTurn]);
      setActiveTurn(null);
    },
    [cwd],
  );

  return (
    <Box flexDirection="column" width="100%">
      {/* Committed header in scrollback */}
      <Static items={staticItems} wrap={false}>
        {(item) => (
          <Header
            key={item.id}
            version={item.version}
            provider={item.provider}
            model={item.model}
            cwd={item.cwd}
            reasoningEffort={item.reasoningEffort}
          />
        )}
      </Static>

      {/* Completed conversational turns in scrollback */}
      <Static items={turns} wrap={true}>
        {(turn) => <TurnView key={turn.id} turn={turn} />}
      </Static>

      {/* Active live streaming turn (if any) */}
      {activeTurn && (
        <Box flexDirection="column" width="100%">
          <TurnView turn={activeTurn} isStreaming={true} />
        </Box>
      )}

      {/* Live prompt input bar */}
      <Box marginTop={1} flexDirection="column" width="100%">
        <PromptInput
          onSubmit={handleSubmit}
          isLoading={activeTurn !== null}
          model={model}
          reasoningEffort={reasoningEffort}
        />
      </Box>
    </Box>
  );
}
