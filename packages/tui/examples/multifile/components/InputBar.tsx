/** @jsxImportSource stitchable */
import { Box, Text, Spacer } from 'stitchable';
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
      borderStyle="single"
      borderLeft={false}
      borderRight={false}
      borderTop={true}
      borderBottom={true}
      borderColor={isStreaming ? theme.borderMuted : theme.borderPrimary}
      paddingY={0}
      paddingX={0}
      marginTop={1}
      width="100%"
    >
      <Box flexDirection="row" width="100%">
        <Text bold color={isStreaming ? theme.textMuted : theme.textBrand}>
          {isStreaming ? '⚡ Generating...' : '▸ Prompt'}
        </Text>
        <Spacer />
        <Text color={theme.textMuted}>
          {isStreaming ? 'Busy' : `${inputText.length} chars`}
        </Text>
      </Box>

      <Text color={theme.textSecondary} wrap="wrap">
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
