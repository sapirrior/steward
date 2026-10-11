/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import type { Theme } from '../../../themes/themeTypes.js';
import type { CompletedTurn, ActiveTurnState } from '../../types.js';
import { toolRendererRegistry } from '../../tool-renderers/registry.js';
import { MarkdownMessage } from './MarkdownMessage.js';

export interface AssistantTurnProps {
  turn: CompletedTurn | ActiveTurnState;
  theme: Theme;
  isStreaming?: boolean;
  isBashCardsExpanded?: boolean;
}

export function AssistantTurn({
  turn,
  theme,
  isStreaming = false,
  isBashCardsExpanded = false,
}: AssistantTurnProps) {
  const colors = theme.colors;

  return (
    <Box flexDirection="column" marginTop={1} width="100%">
      {/* 1. Reasoning / CoT Block */}
      {turn.reasoning ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={colors.warning}>
            Thought:{' '}
            {turn.reasoningDurationMs !== undefined
              ? `${turn.reasoningDurationMs}ms`
              : 'thinking...'}
          </Text>
          <Box marginLeft={1}>
            <Text color={colors.textMuted} wrap="wrap">
              {turn.reasoning}
            </Text>
          </Box>
        </Box>
      ) : null}

      {/* 2. Tool Calls via Registry */}
      {turn.toolCalls && turn.toolCalls.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {turn.toolCalls.map((tc) => {
            const Renderer = toolRendererRegistry.getRenderer(tc.toolName);
            return (
              <Renderer
                key={tc.toolCallId}
                toolCall={tc}
                theme={theme}
                isExpanded={isBashCardsExpanded}
              />
            );
          })}
        </Box>
      ) : null}

      {/* 3. Main Response Text */}
      {turn.text ? (
        <Box flexDirection="column">
          <MarkdownMessage content={turn.text} theme={theme} />
        </Box>
      ) : null}

      {/* 4. Error State */}
      {turn.status === 'error' && turn.errorMessage && (
        <Box marginTop={1}>
          <Text bold color={colors.error}>
            Error: {turn.errorMessage}
          </Text>
        </Box>
      )}

      {/* 5. Aborted State */}
      {turn.status === 'aborted' && (
        <Box marginTop={1}>
          <Text italic color={colors.textDim}>
            [Operation interrupted by user]
          </Text>
        </Box>
      )}
    </Box>
  );
}
