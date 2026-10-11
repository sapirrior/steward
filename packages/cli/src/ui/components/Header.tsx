/**
 * @file Header.tsx
 * @description Compact Claude Code-style header with 'S' emblem and metadata.
 */

import os from 'node:os';
import path from 'node:path';
import { Box, Text } from 'stitchable';
import { STEWARD_S_GLYPH } from '../../constants/index.js';
import { themeManager } from '../../themes/index.js';

export interface HeaderProps {
  version: string;
  provider: string;
  model: string;
  cwd: string;
  reasoningEffort?: string;
}

export function formatTildePath(targetPath: string): string {
  if (!targetPath) return '';
  const home = os.homedir();
  if (targetPath === home) {
    return '~';
  }
  const prefix = home.endsWith(path.sep) ? home : home + path.sep;
  if (targetPath.startsWith(prefix)) {
    return '~' + path.sep + targetPath.slice(prefix.length);
  }
  return targetPath;
}

export function Header({
  version,
  provider,
  model,
  cwd,
  reasoningEffort,
}: HeaderProps) {
  const stewardColor = themeManager.getColor('steward');
  const displayCwd = formatTildePath(cwd);

  return (
    <Box flexDirection="row" gap={2} paddingY={1} overflow="hidden">
      {/* 'S' Emblem from Steward unicode font */}
      <Box flexDirection="column" flexShrink={0} overflow="hidden">
        {STEWARD_S_GLYPH.map((line, idx) => (
          <Text key={idx} color={stewardColor} bold wrap="nowrap">
            {line}
          </Text>
        ))}
      </Box>

      {/* Title & Metadata */}
      <Box flexDirection="column" overflow="hidden">
        <Box flexDirection="row" gap={1}>
          <Text bold color={themeManager.getColor('text')} wrap="nowrap">
            Steward
          </Text>
          <Text color={themeManager.getColor('inactive')} wrap="nowrap">
            v{version}
          </Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text color={themeManager.getColor('inactive')} wrap="nowrap">
            {provider}/{model}
            {reasoningEffort && reasoningEffort !== 'none' ? ` (${reasoningEffort})` : ''}
          </Text>
        </Box>

        <Box flexDirection="row" overflow="hidden">
          <Text color={themeManager.getColor('subtle')} wrap="nowrap">
            {displayCwd}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
