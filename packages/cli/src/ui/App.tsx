/**
 * @file App.tsx
 * @description Main application component hosting the Header in Static scrollback.
 */

import { Box, Static } from 'stitchable';
import { Header } from './components/Header.js';
import { PromptInput } from './components/PromptInput.js';

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
  // Permanent startup items to commit directly to terminal scrollback
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

  const handleSubmit = (value: string, mode: 'prompt' | 'bash') => {
    // Future turn execution hook
  };

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

      {/* Live prompt input bar */}
      <Box marginTop={1} flexDirection="column" width="100%">
        <PromptInput
          onSubmit={handleSubmit}
          model={model}
          reasoningEffort={reasoningEffort}
        />
      </Box>
    </Box>
  );
}
