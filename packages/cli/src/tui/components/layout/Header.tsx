/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { STEWARD_UNICODE_LOGO } from '../../../constants/icons.js';
import type { Theme } from '../../../themes/themeTypes.js';

export interface HeaderProps {
  theme: Theme;
  gitBranch?: string;
  cwd?: string;
  isCompact?: boolean;
}

export function Header({ theme, isCompact = false }: HeaderProps) {
  const colors = theme.colors;

  if (isCompact) {
    return null;
  }

  return (
    <Box flexDirection="column" alignItems="center" width="100%" marginBottom={1}>
      <Text bold color={colors.text}>
        {STEWARD_UNICODE_LOGO}
      </Text>
      <Box marginTop={1}>
        <Text color={colors.warning}>• Tip </Text>
        <Text color={colors.text}>Type </Text>
        <Text bold color={colors.accent}>
          /
        </Text>
        <Text color={colors.text}> to explore slash commands or ask any engineering question</Text>
      </Box>
    </Box>
  );
}
