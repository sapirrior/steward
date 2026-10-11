/**
 * @file UserMessage.tsx
 * @description Claude Code-styled user turn message with userMessageBackground.
 */

import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';

export interface UserMessageProps {
  content: string;
  isBash?: boolean;
}

export function UserMessage({ content, isBash = false }: UserMessageProps) {
  const userBg = themeManager.getColor('userMessageBackground');
  const bashBg = themeManager.getColor('bashMessageBackgroundColor');
  const textColor = themeManager.getColor('text');
  const bashBorderColor = themeManager.getColor('bashBorder');

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      marginBottom={0}
      backgroundColor={isBash ? bashBg : userBg}
      paddingX={1}
      paddingY={0}
      width="100%"
    >
      <Box flexDirection="row">
        {isBash && (
          <Text color={bashBorderColor} bold wrap="nowrap">
            !{' '}
          </Text>
        )}
        <Text color={textColor} wrap="wrap">
          {content}
        </Text>
      </Box>
    </Box>
  );
}
