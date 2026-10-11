/** @jsxImportSource stitchable */
import { Box, Text, useInput, useFocus, useTerminalSize } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';

export interface DialogHostProps {
  isOpen: boolean;
  onClose: () => void;
  theme: Theme;
  children: any;
  width?: number;
}

/**
 * Centered modal overlay container with input capture, Escape dismissal,
 * and exact viewport centering using terminal columns and rows.
 */
export function DialogHost({ isOpen, onClose, theme, children, width = 66 }: DialogHostProps) {
  const { columns, rows } = useTerminalSize();
  const colors = theme.colors;

  // Capture focus in the modal dialog host
  useFocus({ autoFocus: true });

  useInput(
    (event) => {
      if (!isOpen) return false;

      if (event.type === 'key') {
        if (event.key.escape) {
          onClose();
          return true;
        }
      }
      return false;
    },
    { whenFocused: true },
  );

  if (!isOpen) return null;

  // Viewport centering calculations
  const modalWidth = Math.min(width, Math.max(38, columns - 4));
  const modalEstimatedHeight = 12;
  const topPad = Math.max(0, Math.floor((rows - modalEstimatedHeight) / 2));

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      alignItems="center"
      paddingTop={topPad}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={colors.accent}
        backgroundColor={colors.dialogBackground}
        paddingX={1}
        paddingY={1}
        width={modalWidth}
      >
        {children}
      </Box>
    </Box>
  );
}
