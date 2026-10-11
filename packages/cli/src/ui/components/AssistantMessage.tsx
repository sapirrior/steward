/**
 * @file AssistantMessage.tsx
 * @description Assistant response turn with text output, tool call blocks, and status indicators.
 */

import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { ToolUseMessage, type ToolCallItem } from './ToolUseMessage.js';

export interface AssistantMessageProps {
  content?: string;
  toolCalls?: ToolCallItem[];
  isStreaming?: boolean;
}

export function AssistantMessage({
  content,
  toolCalls = [],
  isStreaming = false,
}: AssistantMessageProps) {
  const textColor = themeManager.getColor('text');
  const inactiveColor = themeManager.getColor('inactive');

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      {/* Tool executions (if any) */}
      {toolCalls.length > 0 && (
        <Box flexDirection="column" marginBottom={content ? 1 : 0}>
          {toolCalls.map((tc) => (
            <ToolUseMessage key={tc.id} toolCall={tc} />
          ))}
        </Box>
      )}

      {/* Assistant markdown / text content */}
      {content ? (
        <Box flexDirection="column">
          <Text color={textColor} wrap="wrap">
            {content}
          </Text>
        </Box>
      ) : isStreaming && toolCalls.length === 0 ? (
        <Box flexDirection="row">
          <Text color={inactiveColor} italic wrap="nowrap">
            Thinking...
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
