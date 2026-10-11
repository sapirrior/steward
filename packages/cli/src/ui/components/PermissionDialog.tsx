/**
 * @file PermissionDialog.tsx
 * @description Standardized permission dialog container with rounded top border matching Claude Code.
 */

import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';

export interface PermissionDialogProps {
  title: string;
  subtitle?: string;
  color?: string;
  children: any;
}

export function PermissionDialog({
  title,
  subtitle,
  color,
  children,
}: PermissionDialogProps) {
  const borderColor = color || themeManager.getColor('permission');
  const inactiveColor = themeManager.getColor('inactive');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      borderLeft={false}
      borderRight={false}
      borderBottom={false}
      marginTop={1}
      width="100%"
    >
      <Box paddingX={1} flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={borderColor} wrap="nowrap">
            {title}
          </Text>
        </Box>
        {subtitle && (
          <Text color={inactiveColor} wrap="truncate-start">
            {subtitle}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {children}
      </Box>
    </Box>
  );
}
