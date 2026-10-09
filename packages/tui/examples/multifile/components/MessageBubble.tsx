/** @jsxImportSource stitchable */
import { Box, Text, Spacer, Newline, Transform } from 'stitchable';
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

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      <Box flexDirection="row" width="100%">
        <Transform transform={(line) => line}>
          <Text bold color={roleColor}>
            {roleLabel}
          </Text>
        </Transform>
        <Text color={theme.textMuted}> · {message.timestamp}</Text>
        {message.tokens && (
          <>
            <Spacer />
            <Text color={theme.textMuted}>{message.tokens} tokens</Text>
          </>
        )}
      </Box>
      <Text color={theme.textSecondary} wrap="wrap">
        {message.content}
      </Text>
    </Box>
  );
}
