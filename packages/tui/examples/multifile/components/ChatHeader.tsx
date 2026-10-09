/** @jsxImportSource stitchable */
import { Box, Text, Spacer } from 'stitchable';
import { theme } from '../theme.js';

interface ChatHeaderProps {
  model: string;
  latencyMs?: number;
}

export function ChatHeader({ model, latencyMs = 24 }: ChatHeaderProps) {
  return (
    <Box flexDirection="row" width="100%">
      <Text bold color={theme.textBrand}>
        ◆ STEWARD INTELLIGENCE
      </Text>
      <Text color={theme.textMuted}> │ </Text>
      <Text color={theme.textSecondary}>{model}</Text>
      <Spacer />
      <Text color={theme.textSuccess}>● ACTIVE </Text>
      <Text color={theme.textMuted}>({latencyMs}ms)</Text>
    </Box>
  );
}
