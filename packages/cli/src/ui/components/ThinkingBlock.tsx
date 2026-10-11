/**
 * @file ThinkingBlock.tsx
 * @description Renders thinking blocks with collapsed and expanded modes (∴ Thinking).
 */

import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { Markdown } from './Markdown.js';

export interface ThinkingBlockProps {
  thinking: string;
  isExpanded?: boolean;
  addMargin?: boolean;
}

export function ThinkingBlock({
  thinking,
  isExpanded = false,
  addMargin = false,
}: ThinkingBlockProps) {
  if (!thinking) return null;

  const inactiveColor = themeManager.getColor('inactive');

  if (!isExpanded) {
    return (
      <Box marginTop={addMargin ? 1 : 0} flexDirection="row">
        <Text color={inactiveColor} italic wrap="nowrap">
          ∴ Thinking (ctrl+o to expand)
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      marginTop={addMargin ? 1 : 0}
      width="100%"
    >
      <Text color={inactiveColor} italic wrap="nowrap">
        ∴ Thinking…
      </Text>
      <Box paddingLeft={2} flexDirection="column" width="100%">
        <Markdown>{thinking}</Markdown>
      </Box>
    </Box>
  );
}
