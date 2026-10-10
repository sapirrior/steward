/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { UI_GLYPHS } from '../../../constants/icons.js';
import type { Theme } from '../../../themes/themeTypes.js';

export interface UserMessageProps {
  prompt: string;
  timestamp: string;
  theme: Theme;
}

export function UserMessage({ prompt, timestamp, theme }: UserMessageProps) {
  const colors = theme.colors;

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.cardBackground}
      paddingX={1}
      paddingY={1}
      marginTop={1}
      width="100%"
    >
      <Box flexDirection="row">
        <Text color={colors.accent}>{UI_GLYPHS.accentBar} </Text>
        <Text bold color={colors.text} wrap="wrap">
          {prompt}
        </Text>
      </Box>
      <Box marginLeft={2} marginTop={0}>
        <Text color={colors.textDim}>{timestamp}</Text>
      </Box>
    </Box>
  );
}
