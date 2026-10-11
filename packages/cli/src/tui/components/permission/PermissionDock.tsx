/** @jsxImportSource stitchable */
import { Box, Text, useInput, useFocus } from 'stitchable';
import type { Theme } from '../../../themes/themeTypes.js';

export interface PermissionDockProps {
  toolName: string;
  command: string;
  reason?: string;
  theme: Theme;
  onDecision: (allowed: boolean) => void;
}

/**
 * Focused Permission Dock mounted directly above the PromptInput bar.
 * Consumes keyboard input: [y/Enter] to approve, [n/Esc] to deny.
 * Guaranteed to fail-closed on unmount/abort.
 */
export function PermissionDock({
  toolName,
  command,
  reason,
  theme,
  onDecision,
}: PermissionDockProps) {
  const colors = theme.colors;

  // Capture keyboard focus exclusively
  useFocus({ autoFocus: true });

  useInput(
    (event) => {
      if (event.type === 'key') {
        if (event.input === 'y' || event.input === 'Y' || event.key.return) {
          onDecision(true);
          return true;
        }
        if (event.input === 'n' || event.input === 'N' || event.key.escape) {
          onDecision(false);
          return true;
        }
      }
      return false;
    },
    { whenFocused: true },
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={colors.warning}
      backgroundColor={colors.dialogBackground}
      paddingX={2}
      paddingY={1}
      marginBottom={1}
      width="100%"
    >
      <Box justifyContent="space-between" marginBottom={1}>
        <Box>
          <Text bold color={colors.warning}>
            [SECURITY PERMISSION REQUIRED]
          </Text>
          <Text color={colors.textDim}> · Tool: {toolName}</Text>
        </Box>
        <Text color={colors.textDim}>[y: Allow | n/Esc: Deny]</Text>
      </Box>

      <Box marginBottom={1} backgroundColor={colors.cardBackground} paddingX={1}>
        <Text bold color={colors.text}>
          $ {command}
        </Text>
      </Box>

      {reason && (
        <Box marginBottom={1}>
          <Text color={colors.textMuted}>Reason: {reason}</Text>
        </Box>
      )}

      <Box>
        <Text color={colors.textDim}>Press </Text>
        <Text bold color={colors.success}>
          [Enter / y]
        </Text>
        <Text color={colors.textDim}> to authorize this execution, or </Text>
        <Text bold color={colors.error}>
          [Esc / n]
        </Text>
        <Text color={colors.textDim}> to deny.</Text>
      </Box>
    </Box>
  );
}
