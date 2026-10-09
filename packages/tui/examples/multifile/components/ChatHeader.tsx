/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { theme } from '../theme.js';


interface ChatHeaderProps {
  model: string;
  latencyMs?: number;
}

export function ChatHeader({ model, latencyMs = 24 }: ChatHeaderProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderPrimary}
      paddingX={1}
      width="100%"
    >
      <Box flexDirection="row" justifyContent="space-between" width="100%">
        <Box flexDirection="row">
          <Text bold color={theme.textBrand}>
            ◆ STEWARD INTELLIGENCE
          </Text>
          <Text color={theme.textMuted}> │ </Text>
          <Text color={theme.textSecondary}>{model}</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={theme.textSuccess}>● ACTIVE </Text>
          <Text color={theme.textMuted}>({latencyMs}ms)</Text>
        </Box>
      </Box>
    </Box>
  );
}
