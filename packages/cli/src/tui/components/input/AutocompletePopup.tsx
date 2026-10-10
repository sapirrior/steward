/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';
import type { SlashCommand } from '../../commands/commandRegistry.js';

export interface AutocompletePopupProps {
  commands: SlashCommand[];
  selectedIndex: number;
  theme: Theme;
}

export function AutocompletePopup({ commands, selectedIndex, theme }: AutocompletePopupProps) {
  const colors = theme.colors;

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.dialogBackground}
      borderStyle="single"
      borderColor={colors.border}
      paddingX={1}
      paddingY={0}
      width="100%"
    >
      {commands.slice(0, 8).map((cmd, idx) => {
        const isSelected = idx === selectedIndex;
        return (
          <Box
            key={cmd.name}
            flexDirection="row"
            backgroundColor={isSelected ? colors.selectionBackground : undefined}
          >
            <Text bold color={isSelected ? colors.accentActive : colors.text}>
              /{cmd.name.padEnd(14)}
            </Text>
            <Text color={isSelected ? colors.text : colors.textMuted}>{cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
