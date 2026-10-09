/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { theme } from '../theme.js';


interface StatusFooterProps {
  totalMessages: number;
}

export function StatusFooter({ totalMessages }: StatusFooterProps) {
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1} width="100%">
      <Box flexDirection="row">
        <Text color={theme.textMuted}>[Enter] Send  </Text>
        <Text color={theme.textMuted}>[←/→] Edit  </Text>
        <Text color={theme.textMuted}>[Ctrl+C] Exit</Text>
      </Box>
      <Text color={theme.textMuted}>{totalMessages} turns in memory</Text>
    </Box>
  );
}
