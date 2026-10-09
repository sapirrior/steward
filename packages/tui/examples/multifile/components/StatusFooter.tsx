/** @jsxImportSource stitchable */
import { Box, Text, Spacer } from 'stitchable';
import { theme } from '../theme.js';

interface StatusFooterProps {
  totalMessages: number;
}

export function StatusFooter({ totalMessages }: StatusFooterProps) {
  return (
    <Box flexDirection="row" width="100%">
      <Text color={theme.textMuted}>[Enter] Send  [←/→] Navigate  [Ctrl+C] Exit</Text>
      <Spacer />
      <Text color={theme.textMuted}>{totalMessages} turns</Text>
    </Box>
  );
}
