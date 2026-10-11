/**
 * @file TurnView.tsx
 * @description Renders a complete conversational turn (User query + Assistant response with tool calls).
 */

import { Box } from 'stitchable';
import { UserMessage } from './UserMessage.js';
import { AssistantMessage } from './AssistantMessage.js';
import type { ToolCallItem } from './ToolUseMessage.js';

export interface ChatTurn {
  id: string;
  userPrompt: string;
  isBash: boolean;
  assistantContent?: string;
  toolCalls?: ToolCallItem[];
  error?: string;
}

export interface TurnViewProps {
  turn: ChatTurn;
  isStreaming?: boolean;
}

export function TurnView({ turn, isStreaming = false }: TurnViewProps) {
  return (
    <Box flexDirection="column" width="100%">
      {/* Committed user message */}
      <UserMessage content={turn.userPrompt} isBash={turn.isBash} />

      {/* Assistant response and tool calls */}
      <AssistantMessage
        content={turn.assistantContent}
        toolCalls={turn.toolCalls}
        isStreaming={isStreaming}
      />
    </Box>
  );
}
