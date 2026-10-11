/**
 * @file Markdown.tsx
 * @description Markdown rendering component for assistant responses matching Claude Code.
 */

import { Box, Text } from 'stitchable';
import { applyMarkdown } from '../../utils/markdown.js';
import { themeManager } from '../../themes/index.js';

export interface MarkdownProps {
  children?: any;
}

export function Markdown({ children }: MarkdownProps) {
  const currentTheme = themeManager.themeName;
  const contentStr = typeof children === 'string' ? children : children != null ? String(children) : '';
  const rendered = applyMarkdown(contentStr, currentTheme);

  return (
    <Box flexDirection="column" width="100%">
      <Text wrap="wrap">{rendered}</Text>
    </Box>
  );
}
