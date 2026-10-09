/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { theme } from '../theme.js';

import type { ChatMessage } from '../types.js';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const roleColor = isUser
    ? theme.badgeUser
    : isSystem
      ? theme.badgeSystem
      : theme.badgeAssistant;

  const roleLabel = isUser ? 'USER' : isSystem ? 'SYSTEM' : 'CLAUDE 3.7';
  const borderColor = isUser ? theme.borderUser : theme.borderAssistant;

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      <Box flexDirection="row" justifyContent="space-between">
        <Box flexDirection="row">
          <Text bold color={roleColor}>
            {roleLabel}
          </Text>
          <Text color={theme.textMuted}> · {message.timestamp}</Text>
        </Box>
        {message.tokens && (
          <Text color={theme.textMuted}>{message.tokens} tokens</Text>
        )}
      </Box>

      <Box
        borderStyle="single"
        borderColor={borderColor}
        paddingX={1}
        marginTop={0}
        width="100%"
      >
        <Text color={theme.textSecondary}>{message.content}</Text>
      </Box>
    </Box>
  );
}
