/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import { UI_GLYPHS } from '../../../constants/icons.js';
import type { Theme } from '../../../themes/themeTypes.js';
import type { ModelRef } from '@steward/models';
import type { ReasoningEffort } from '../../../agent/types.js';

export interface PromptInputProps {
  inputText: string;
  cursorPos: number;
  modelRef: ModelRef;
  reasoningEffort: ReasoningEffort;
  isRunning?: boolean;
  theme: Theme;
  placeholder?: string;
  suggestedCommands?: Array<{ name: string; displayLabel: string; description: string }>;
  selectedCommandIndex?: number;
}

export function PromptInput({
  inputText,
  cursorPos,
  modelRef,
  reasoningEffort,
  isRunning = false,
  theme,
  placeholder: customPlaceholder,
  suggestedCommands = [],
  selectedCommandIndex = 0,
}: PromptInputProps) {
  const colors = theme.colors;
  const highlightBg = '#fdba74'; // Peach highlight
  const highlightText = '#000000';

  const beforeCursor = inputText.slice(0, cursorPos);
  const cursorChar = inputText[cursorPos] || ' ';
  const afterCursor = inputText.slice(cursorPos + 1);

  const placeholder = customPlaceholder ?? 'Ask anything... "Fix broken tests"';
  const showCommandSuggestions = suggestedCommands.length > 0 && !isRunning;

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.cardBackground}
      paddingX={1}
      paddingY={1}
      marginTop={1}
      width="100%"
    >
      {/* Inline Slash Command Suggestions Popup */}
      {showCommandSuggestions && (
        <Box
          flexDirection="column"
          backgroundColor={colors.dialogBackground}
          borderStyle="round"
          borderColor={colors.border}
          marginBottom={1}
          paddingX={1}
          paddingY={0}
          width="100%"
        >
          {suggestedCommands.map((cmd, idx) => {
            const isSelected = idx === selectedCommandIndex;
            return (
              <Box
                key={cmd.name}
                flexDirection="row"
                justifyContent="space-between"
                backgroundColor={isSelected ? highlightBg : undefined}
                paddingX={1}
                width="100%"
              >
                <Text bold={isSelected} color={isSelected ? highlightText : colors.text}>
                  {cmd.displayLabel.padEnd(18)}
                </Text>
                <Text color={isSelected ? highlightText : colors.textDim}>
                  {cmd.description}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* 1. Interactive Input Row */}
      <Box flexDirection="row">
        <Text color={colors.accentActive}>{UI_GLYPHS.accentBar} </Text>
        {inputText.length === 0 && !isRunning ? (
          <Text color={colors.textDim}>
            <Text inverse bold color={colors.accent}>
              {' '}
            </Text>
            {placeholder}
          </Text>
        ) : (
          <Text color={colors.text} wrap="wrap">
            {beforeCursor}
            {!isRunning && (
              <Text inverse bold color={colors.accent}>
                {cursorChar}
              </Text>
            )}
            {!isRunning && afterCursor}
          </Text>
        )}
      </Box>

      {/* 2. Sub-Bar Mode Line */}
      <Box flexDirection="row" marginTop={1} marginLeft={2}>
        <Text bold color={colors.accent}>
          Build
        </Text>
        <Text color={colors.textDim}> · </Text>
        <Text bold color={colors.text}>
          {modelRef.modelId}
        </Text>
        <Text color={colors.textDim}> {modelRef.provider}</Text>
        {reasoningEffort !== 'none' && (
          <Text color={colors.textDim}> · effort: {reasoningEffort}</Text>
        )}
      </Box>
    </Box>
  );
}
