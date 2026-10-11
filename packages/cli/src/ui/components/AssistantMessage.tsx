/**
 * @file AssistantMessage.tsx
 * @description Assistant response turn with text output, tool call blocks, and status indicators.
 */

import { Box } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { ToolUseMessage, type ToolCallItem } from './ToolUseMessage.js';
import { Markdown } from './Markdown.js';
import { ThinkingBlock } from './ThinkingBlock.js';
import { ThinkingAnimation } from './ThinkingAnimation.js';

export interface AssistantMessageProps {
  content?: string;
  thinking?: string;
  isThinkingExpanded?: boolean;
  toolCalls?: ToolCallItem[];
  isStreaming?: boolean;
}

export function AssistantMessage({
  content,
  thinking,
  isThinkingExpanded = false,
  toolCalls = [],
  isStreaming = false,
}: AssistantMessageProps) {
  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      {/* Assistant Thinking block (if any) */}
      {thinking && (
        <ThinkingBlock
          thinking={thinking}
          isExpanded={isThinkingExpanded}
          addMargin={false}
        />
      )}

      {/* Tool executions (if any) */}
      {toolCalls.length > 0 && (
        <Box flexDirection="column" marginTop={thinking ? 1 : 0} marginBottom={content ? 1 : 0}>
          {toolCalls.map((tc) => (
            <ToolUseMessage key={tc.id} toolCall={tc} />
          ))}
        </Box>
      )}

      {/* Assistant markdown / text content */}
      {content ? (
        <Box flexDirection="column" width="100%">
          <Markdown>{content}</Markdown>
        </Box>
      ) : isStreaming && toolCalls.length === 0 && !thinking ? (
        <ThinkingAnimation />
      ) : null}
    </Box>
  );
}
