/**
 * @file PromptFooter.tsx
 * @description Bottom status and hint bar below the prompt input matching Claude Code.
 */

import { Box, Text, Spacer } from 'stitchable';
import { themeManager } from '../../themes/index.js';

export interface PromptFooterProps {
  mode: 'prompt' | 'bash';
  exitWarning: boolean;
  model?: string;
  reasoningEffort?: string;
  isLoading?: boolean;
}

export function PromptFooter({
  mode,
  exitWarning,
  model,
  reasoningEffort,
  isLoading,
}: PromptFooterProps) {
  const inactiveColor = themeManager.getColor('inactive');
  const warningColor = themeManager.getColor('warning');
  const bashColor = themeManager.getColor('bashBorder');

  return (
    <Box flexDirection="row" width="100%" paddingX={0}>
      {/* Left side: hints / status / warnings */}
      <Box flexDirection="row">
        {exitWarning ? (
          <Text color={warningColor} bold wrap="nowrap">
            Press Ctrl+C again to exit
          </Text>
        ) : mode === 'bash' ? (
          <Text color={bashColor} wrap="nowrap">
            Bash mode · commands run directly in subshell
          </Text>
        ) : (
          <Text color={inactiveColor} wrap="nowrap">
            ? for shortcuts
          </Text>
        )}
      </Box>

      <Spacer />

      {/* Right side: model identifier */}
      {model && !isLoading && (
        <Box flexDirection="row">
          <Text color={inactiveColor} wrap="nowrap">
            {model}
            {reasoningEffort && reasoningEffort !== 'none' ? ` (${reasoningEffort})` : ''}
          </Text>
        </Box>
      )}
    </Box>
  );
}
