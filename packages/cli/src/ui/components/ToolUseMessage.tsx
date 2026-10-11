/**
 * @file ToolUseMessage.tsx
 * @description Claude Code-styled tool execution message with tool glyph, name, tagline, and status colors.
 */

import { Box, Text } from 'stitchable';
import { TOOL_GLYPHS, BLACK_CIRCLE, UI_GLYPHS } from '../../constants/index.js';
import { themeManager } from '../../themes/index.js';

export interface ToolCallItem {
  id: string;
  name: string;
  input: Record<string, any>;
  status?: 'running' | 'success' | 'error';
  output?: string;
  error?: string;
}

export interface ToolUseMessageProps {
  toolCall: ToolCallItem;
  verbose?: boolean;
}

/**
 * Returns the human-readable user facing name for a tool.
 */
export function getToolUserFacingName(name: string): string {
  switch (name.toLowerCase()) {
    case 'bash':
      return 'Bash';
    case 'read':
    case 'fileread':
      return 'Read';
    case 'glob':
      return 'Glob';
    case 'grep':
      return 'Grep';
    case 'webfetch':
      return 'WebFetch';
    case 'websearch':
      return 'WebSearch';
    case 'taskmanager':
    case 'tasks':
      return 'Tasks';
    default:
      return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

/**
 * Extracts the user-facing tagline parameter for a tool call.
 */
export function getToolTagline(name: string, input: Record<string, any> = {}): string {
  switch (name.toLowerCase()) {
    case 'bash':
      return input.command ? String(input.command).trim() : '';
    case 'read':
    case 'fileread':
      return input.file_path || input.path || input.target || '';
    case 'glob':
      return input.pattern || input.glob || '';
    case 'grep':
      return input.pattern || input.query || '';
    case 'webfetch':
      return input.url || '';
    case 'websearch':
      return input.query || input.search || '';
    case 'taskmanager':
    case 'tasks':
      return input.action || input.taskId || '';
    default:
      return input.query || input.path || input.command || Object.values(input)[0] || '';
  }
}

/**
 * Gets the specific glyph for a tool matching Claude Code.
 */
export function getToolGlyph(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'bash') return TOOL_GLYPHS.bash;
  if (lower === 'read' || lower === 'fileread' || lower === 'glob' || lower === 'grep') {
    return TOOL_GLYPHS.read;
  }
  if (lower === 'webfetch' || lower === 'websearch') {
    return TOOL_GLYPHS.webfetch;
  }
  return BLACK_CIRCLE;
}

export function ToolUseMessage({ toolCall }: ToolUseMessageProps) {
  const { name, input, status = 'success', error } = toolCall;

  const toolName = getToolUserFacingName(name);
  const tagline = getToolTagline(name, input);
  const glyph = getToolGlyph(name);

  // Status colors
  const successColor = themeManager.getColor('success');
  const errorColor = themeManager.getColor('error');
  const inactiveColor = themeManager.getColor('inactive');
  const subtleColor = themeManager.getColor('subtle');
  const textColor = themeManager.getColor('text');

  let glyphColor: string | undefined = undefined;
  let isDimmed = false;

  if (status === 'running') {
    isDimmed = true;
  } else if (status === 'error' || error) {
    glyphColor = errorColor;
  } else {
    glyphColor = successColor;
  }

  return (
    <Box flexDirection="column" marginY={0}>
      {/* Tool line: [Glyph] ToolName(tagline) */}
      <Box flexDirection="row" flexWrap="nowrap">
        {/* Status indicator glyph */}
        <Box minWidth={2}>
          <Text color={glyphColor} dimColor={isDimmed} bold wrap="nowrap">
            {status === 'running' ? UI_GLYPHS.runningSpinner : glyph}
          </Text>
        </Box>

        {/* User facing tool name */}
        <Text bold color={textColor} wrap="nowrap">
          {toolName}
        </Text>

        {/* Tool tagline in parentheses */}
        {tagline && (
          <Box flexShrink={1}>
            <Text color={inactiveColor} wrap="truncate-end">
              ({tagline})
            </Text>
          </Box>
        )}
      </Box>

      {/* Optional error message if failed */}
      {error && (
        <Box marginLeft={2}>
          <Text color={errorColor} wrap="wrap">
            {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
