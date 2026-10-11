/**
 * @file PromptInput.tsx
 * @description Interactive prompt input matching Claude Code with readline editing,
 * mode indicators (❯ / !), command history, and double Ctrl+C exit.
 */

import { Box, Text, useInput, useApp, useState, useRef, useCallback } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { usePromptHistory } from '../hooks/usePromptHistory.js';
import { PromptFooter } from './PromptFooter.js';

export interface PromptInputProps {
  onSubmit: (value: string, mode: 'prompt' | 'bash') => void;
  isLoading?: boolean;
  placeholder?: string;
  model?: string;
  reasoningEffort?: string;
}

export function PromptInput({
  onSubmit,
  isLoading = false,
  placeholder = 'Ask anything...',
  model,
  reasoningEffort,
}: PromptInputProps) {
  const app = useApp();
  const [value, setValue] = useState('');
  const [cursorOffset, setCursorOffset] = useState(0);
  const [exitWarning, setExitWarning] = useState(false);

  // Synchronous mutable ref mirrors (Stitchable state synchronization invariant)
  const valueRef = useRef(value);
  valueRef.current = value;
  const cursorOffsetRef = useRef(cursorOffset);
  cursorOffsetRef.current = cursorOffset;

  const lastCtrlCRef = useRef<number>(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addHistory, navigateUp, navigateDown, resetNavigation } = usePromptHistory();

  // Mode detection: starts with '!' is bash mode
  const isBashMode = value.startsWith('!');
  const mode: 'prompt' | 'bash' = isBashMode ? 'bash' : 'prompt';

  const updateState = useCallback((newValue: string, newOffset: number) => {
    valueRef.current = newValue;
    cursorOffsetRef.current = Math.max(0, Math.min(newOffset, newValue.length));
    setValue(newValue);
    setCursorOffset(cursorOffsetRef.current);
  }, []);

  useInput((ev) => {
    if (isLoading) return;

    // 1. Bracketed paste handling
    if (ev.type === 'paste' && ev.text) {
      const sanitized = ev.text.replace(/\r\n|\r/g, '\n');
      const curVal = valueRef.current;
      const offset = cursorOffsetRef.current;
      const nextVal = curVal.slice(0, offset) + sanitized + curVal.slice(offset);
      updateState(nextVal, offset + sanitized.length);
      return true;
    }

    if (ev.type !== 'key') return;

    const { key, input } = ev;
    const curVal = valueRef.current;
    const offset = cursorOffsetRef.current;

    // 2. Ctrl+C handling
    if (key.ctrl && key.name === 'c') {
      if (curVal.length > 0) {
        // Clear current input
        updateState('', 0);
        resetNavigation();
        return true;
      }

      // Input is empty: double Ctrl+C to exit
      const now = Date.now();
      if (now - lastCtrlCRef.current < 1000) {
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        app.exit();
      } else {
        lastCtrlCRef.current = now;
        setExitWarning(true);
        if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
        exitTimerRef.current = setTimeout(() => {
          setExitWarning(false);
        }, 1000);
      }
      return true;
    }

    // 3. Return / Enter: submit
    if (key.return) {
      const trimmed = curVal.trim();
      if (!trimmed) return true;

      const submitMode = isBashMode ? 'bash' : 'prompt';
      const cleanValue = isBashMode ? trimmed.slice(1).trim() : trimmed;

      if (cleanValue) {
        addHistory(trimmed);
        updateState('', 0);
        onSubmit(cleanValue, submitMode);
      }
      return true;
    }

    // 4. History Navigation: Up / Down
    if (key.upArrow) {
      const recalled = navigateUp(curVal);
      if (recalled !== null) {
        updateState(recalled, recalled.length);
      }
      return true;
    }

    if (key.downArrow) {
      const recalled = navigateDown();
      if (recalled !== null) {
        updateState(recalled, recalled.length);
      }
      return true;
    }

    // 5. Left / Right navigation
    if (key.leftArrow) {
      if (key.meta || key.ctrl) {
        // Word left
        const leftPart = curVal.slice(0, offset);
        const match = leftPart.match(/\S+\s*$/);
        const jump = match ? match[0].length : 1;
        updateState(curVal, Math.max(0, offset - jump));
      } else {
        updateState(curVal, Math.max(0, offset - 1));
      }
      return true;
    }

    if (key.rightArrow) {
      if (key.meta || key.ctrl) {
        // Word right
        const rightPart = curVal.slice(offset);
        const match = rightPart.match(/^\s*\S+/);
        const jump = match ? match[0].length : 1;
        updateState(curVal, Math.min(curVal.length, offset + jump));
      } else {
        updateState(curVal, Math.min(curVal.length, offset + 1));
      }
      return true;
    }

    // 6. Home / End
    if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
      updateState(curVal, 0);
      return true;
    }

    if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
      updateState(curVal, curVal.length);
      return true;
    }

    // 7. Backspace
    if (key.backspace) {
      if (offset > 0) {
        const nextVal = curVal.slice(0, offset - 1) + curVal.slice(offset);
        updateState(nextVal, offset - 1);
      }
      return true;
    }

    // 8. Delete
    if (key.delete || (key.ctrl && key.name === 'd')) {
      if (offset < curVal.length) {
        const nextVal = curVal.slice(0, offset) + curVal.slice(offset + 1);
        updateState(nextVal, offset);
      }
      return true;
    }

    // 9. Readline shortcuts: Ctrl+U, Ctrl+K, Ctrl+W
    if (key.ctrl && key.name === 'u') {
      // Clear from start to cursor
      updateState(curVal.slice(offset), 0);
      return true;
    }

    if (key.ctrl && key.name === 'k') {
      // Clear from cursor to end
      updateState(curVal.slice(0, offset), offset);
      return true;
    }

    if (key.ctrl && key.name === 'w') {
      // Delete previous word
      const leftPart = curVal.slice(0, offset);
      const match = leftPart.match(/\S+\s*$/);
      const jump = match ? match[0].length : 0;
      const nextVal = curVal.slice(0, offset - jump) + curVal.slice(offset);
      updateState(nextVal, offset - jump);
      return true;
    }

    // 10. Printable characters
    if (input && !key.ctrl && !key.meta) {
      const nextVal = curVal.slice(0, offset) + input + curVal.slice(offset);
      updateState(nextVal, offset + input.length);
      return true;
    }
  });

  // Render components
  const bashColor = themeManager.getColor('bashBorder');
  const promptBorderColor = themeManager.getColor('promptBorder');
  const borderColor = isBashMode ? bashColor : promptBorderColor;
  const textColor = themeManager.getColor('text');
  const subtleColor = themeManager.getColor('subtle');
  const inactiveColor = themeManager.getColor('inactive');

  // Split value around cursor
  const beforeCursor = value.slice(0, cursorOffset);
  const cursorChar = value[cursorOffset] ?? ' ';
  const afterCursor = value.slice(cursorOffset + 1);

  return (
    <Box flexDirection="column" width="100%">
      {/* Input line with top and bottom borders */}
      <Box
        flexDirection="row"
        alignItems="flex-start"
        justifyContent="flex-start"
        borderStyle="round"
        borderColor={borderColor}
        borderLeft={false}
        borderRight={false}
        borderTop={true}
        borderBottom={true}
        width="100%"
        paddingY={0}
      >
        {/* Input content with cursor */}
        {value.length === 0 ? (
          <Box flexDirection="row">
            {!isLoading && (
              <Text inverse bold color={textColor}>
                {' '}
              </Text>
            )}
            <Text color={subtleColor} wrap="nowrap">
              {placeholder}
            </Text>
          </Box>
        ) : (
          <Box flexDirection="row" overflow="hidden">
            <Text color={textColor} wrap="nowrap">
              {beforeCursor}
            </Text>
            {!isLoading && (
              <Text inverse bold color={textColor} wrap="nowrap">
                {cursorChar}
              </Text>
            )}
            <Text color={textColor} wrap="nowrap">
              {afterCursor}
            </Text>
          </Box>
        )}
      </Box>

      {/* Footer line below the bottom border */}
      <Box marginTop={0}>
        <PromptFooter
          mode={mode}
          exitWarning={exitWarning}
          model={model}
          reasoningEffort={reasoningEffort}
          isLoading={isLoading}
        />
      </Box>
    </Box>
  );
}
