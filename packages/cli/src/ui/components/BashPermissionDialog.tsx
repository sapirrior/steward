/**
 * @file BashPermissionDialog.tsx
 * @description Bash command confirmation dialog with command details and options.
 */

import { useState } from 'stitchable';
import { Box, Text } from 'stitchable';
import { useInput } from 'stitchable';
import { themeManager } from '../../themes/index.js';
import { PermissionDialog } from './PermissionDialog.js';

export interface BashPermissionDialogProps {
  command: string;
  description?: string;
  onAllow: () => void;
  onDeny: () => void;
}

export function BashPermissionDialog({
  command,
  description,
  onAllow,
  onDeny,
}: BashPermissionDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const options = [
    { label: 'Yes', description: 'Run this command once', action: onAllow },
    { label: 'No', description: 'Deny and tell assistant', action: onDeny },
  ];

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      options[selectedIndex]?.action();
    } else if (key.escape) {
      onDeny();
    }
  });

  const inactiveColor = themeManager.getColor('inactive');
  const textColor = themeManager.getColor('text');
  const permissionColor = themeManager.getColor('permission');

  return (
    <PermissionDialog title="Bash command">
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Box flexDirection="row">
          <Text bold color={permissionColor} wrap="nowrap">
            ${' '}
          </Text>
          <Text color={textColor} wrap="wrap">
            {command}
          </Text>
        </Box>
        {description && (
          <Text color={inactiveColor} wrap="wrap">
            {description}
          </Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color={textColor} bold wrap="nowrap">
          Do you want to proceed?
        </Text>
        {options.map((opt, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <Box key={opt.label} flexDirection="row" marginTop={0}>
              <Text color={isSelected ? permissionColor : inactiveColor} bold={isSelected} wrap="nowrap">
                {isSelected ? '❯ ' : '  '}
                {opt.label}
              </Text>
              <Text color={inactiveColor} wrap="nowrap">
                {' · '}{opt.description}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box justifyContent="space-between" marginTop={1}>
        <Text color={inactiveColor} wrap="nowrap">
          Esc to cancel · Enter to select
        </Text>
      </Box>
    </PermissionDialog>
  );
}
