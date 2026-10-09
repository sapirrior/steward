/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { theme } from '../theme.js';


interface InputBarProps {
  inputText: string;
  cursorPos: number;
  isStreaming: boolean;
}

export function InputBar({ inputText, cursorPos, isStreaming }: InputBarProps) {
  const beforeCursor = inputText.slice(0, cursorPos);
  const cursorChar = inputText[cursorPos] || ' ';
  const afterCursor = inputText.slice(cursorPos + 1);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isStreaming ? theme.borderMuted : theme.borderPrimary}
      paddingX={1}
      marginTop={1}
      width="100%"
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={isStreaming ? theme.textMuted : theme.textBrand}>
          {isStreaming ? '⚡ Generating response...' : '▸ Message / Command'}
        </Text>
        <Text color={theme.textMuted}>
          {isStreaming ? 'Busy' : `${inputText.length} chars`}
        </Text>
      </Box>

      <Text color={theme.textSecondary}>
        <Text color={theme.textBrand}>&gt; </Text>
        {beforeCursor}
        {!isStreaming && (
          <Text inverse bold color={theme.badgeAssistant}>
            {cursorChar}
          </Text>
        )}
        {!isStreaming && afterCursor}
      </Text>
    </Box>
  );
}
