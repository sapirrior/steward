/**
 * @file App.tsx
 * @description Main application component hosting the Header in Static scrollback.
 */

import { Box, Static } from 'stitchable';
import { Header } from './components/Header.js';

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
    </Box>
  );
}
