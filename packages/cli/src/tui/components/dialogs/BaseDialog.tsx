/** @jsxImportSource stitchable */
import { Box, Text } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';

export interface DialogItem {
  id: string;
  label: string;
  description?: string;
  meta?: string;
}

export interface BaseDialogProps {
  title?: string;
  items: DialogItem[];
  selectedIndex: number;
  theme: Theme;
  maxVisible?: number;
  emptyText?: string;
}

export function BaseDialog({
  title,
  items,
  selectedIndex,
  theme,
  maxVisible = 8,
  emptyText = 'No items found',
}: BaseDialogProps) {
  const colors = theme.colors;
  const highlightBg = '#fdba74'; // Peach/orange highlight from reference screenshots
  const highlightText = '#000000';

  if (items.length === 0) {
    return (
      <Box
        flexDirection="column"
        backgroundColor={colors.dialogBackground}
        paddingX={1}
        paddingY={0}
        width="100%"
      >
        {title && (
          <Box paddingX={1} paddingY={0}>
            <Text bold color={colors.textDim}>
              {title.toUpperCase()}
            </Text>
          </Box>
        )}
        <Box paddingX={1} paddingY={0}>
          <Text color={colors.textMuted}>{emptyText}</Text>
        </Box>
      </Box>
    );
  }

  // Scroll window calculation
  const total = items.length;
  let startIndex = 0;
  if (selectedIndex >= maxVisible) {
    startIndex = selectedIndex - maxVisible + 1;
  }
  const visibleItems = items.slice(startIndex, startIndex + maxVisible);

  // Scrollbar thumb indicator calculation
  const hasScrollbar = total > maxVisible;
  const scrollFraction = total > 1 ? selectedIndex / (total - 1) : 0;
  const thumbIndex = Math.min(
    visibleItems.length - 1,
    Math.floor(scrollFraction * visibleItems.length),
  );

  return (
    <Box
      flexDirection="column"
      backgroundColor={colors.dialogBackground}
      paddingX={0}
      paddingY={0}
      width="100%"
    >
      {title && (
        <Box paddingX={1} paddingY={0}>
          <Text bold color={colors.textDim}>
            {title.toUpperCase()}
          </Text>
        </Box>
      )}
      {visibleItems.map((item, relIdx) => {
        const absIdx = startIndex + relIdx;
        const isSelected = absIdx === selectedIndex;
        const isThumb = hasScrollbar && relIdx === thumbIndex;
        const scrollChar = hasScrollbar ? (isThumb ? '█' : '│') : '';

        return (
          <Box
            key={item.id}
            flexDirection="row"
            justifyContent="space-between"
            backgroundColor={isSelected ? highlightBg : undefined}
            paddingX={1}
            paddingY={0}
            width="100%"
          >
            <Box flexDirection="row">
              <Text bold={isSelected} color={isSelected ? highlightText : colors.text}>
                {item.label}
              </Text>
              {item.description && (
                <Text color={isSelected ? highlightText : colors.textMuted}>
                  {'   ' + item.description}
                </Text>
              )}
            </Box>

            <Box flexDirection="row">
              {item.meta && (
                <Text color={isSelected ? highlightText : colors.textDim}>{item.meta + ' '}</Text>
              )}
              {hasScrollbar && (
                <Text color={isSelected ? highlightText : colors.border}>{scrollChar}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
