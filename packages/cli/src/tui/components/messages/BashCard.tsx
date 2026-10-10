/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';

export interface BashCardProps {
  command: string;
  output?: string;
  theme: Theme;
  isExpanded?: boolean;
}

export function BashCard({ command, output, theme, isExpanded = false }: BashCardProps) {
  const colors = theme.colors;

  const cleanOutput = output ? output.trimEnd() : '';
  const lines = cleanOutput ? cleanOutput.split('\n') : [];
  const maxCollapsedLines = 10;
  const isOverflow = lines.length > maxCollapsedLines;

  const displayedText =
    isOverflow && !isExpanded ? lines.slice(0, maxCollapsedLines).join('\n') : cleanOutput;

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.cardBackground}
      paddingX={1}
      paddingY={1}
      marginTop={1}
      marginBottom={1}
      width="100%"
    >
      <Text bold color={colors.text}>
        $ {command}
      </Text>

      {displayedText ? (
        <Box marginTop={1}>
          <Text color={colors.text} wrap="wrap">
            {displayedText}
          </Text>
        </Box>
      ) : null}

      {isOverflow && (
        <Box marginTop={1} flexDirection="column">
          {!isExpanded && <Text color={colors.textDim}>...</Text>}
          <Box marginTop={1}>
            <Text color={colors.textDim}>
              {isExpanded
                ? '(ctrl+o to collapse)'
                : `(ctrl+o to expand ${lines.length - maxCollapsedLines} lines)`}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
