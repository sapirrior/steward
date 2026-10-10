/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { TOOL_GLYPHS, UI_GLYPHS } from '../../../constants/icons.js';
import type { Theme } from '../../../themes/themeTypes.js';
import type { ActiveToolCallState } from '../../types.js';

export interface ToolCallItemProps {
  toolCall: ActiveToolCallState;
  theme: Theme;
}

export function ToolCallItem({ toolCall, theme }: ToolCallItemProps) {
  const colors = theme.colors;
  const glyph = (TOOL_GLYPHS as Record<string, string>)[toolCall.toolName] || '✱';

  if (toolCall.status === 'running') {
    return (
      <Box flexDirection="row" marginLeft={2}>
        <Text color={colors.textMuted}>{glyph} </Text>
        <Text color={colors.textMuted}>
          {toolCall.toolName}: {toolCall.tagline}
        </Text>
      </Box>
    );
  }

  const durationStr = toolCall.durationMs ? ` (${toolCall.durationMs}ms)` : '';

  if (toolCall.isError) {
    return (
      <Box flexDirection="row" marginLeft={2}>
        <Text color={colors.error}>{UI_GLYPHS.cross} </Text>
        <Text color={colors.error}>
          {toolCall.toolName}: {toolCall.tagline}
          {durationStr}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" marginLeft={2}>
      <Text color={colors.textDim}>{UI_GLYPHS.check} </Text>
      <Text color={colors.textMuted}>
        {toolCall.toolName}: {toolCall.tagline}
        {durationStr}
      </Text>
    </Box>
  );
}
