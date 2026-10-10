/** @jsxImportSource stitchable */
import { Box, Text, Spacer } from 'stitchable';
import type { Theme } from '../../themes/themeTypes.js';
import type { TuiMetrics } from '../../types.js';

export interface FooterProps {
  cwd: string;
  gitBranch?: string;
  metrics: TuiMetrics;
  isRunning?: boolean;
  spinnerChar?: string;
  theme: Theme;
}

export function Footer({
  cwd,
  gitBranch,
  metrics,
  isRunning = false,
  spinnerChar = '✢',
  theme,
}: FooterProps) {
  const colors = theme.colors;

  const branchDisplay = gitBranch ? `:${gitBranch}` : '';
  const locationText = `${cwd}${branchDisplay}`;

  const tokensK = (metrics.totalTokens / 1000).toFixed(1);
  const contextPct = metrics.contextPercentage ? ` (${metrics.contextPercentage}%)` : '';
  const costDisplay =
    metrics.estimatedCostUsd > 0 ? ` · $${metrics.estimatedCostUsd.toFixed(2)}` : '';

  return (
    <Box flexDirection="row" width="100%" marginTop={1}>
      {/* 1. Left CWD & Git branch */}
      <Text color={colors.textDim}>{locationText}</Text>

      <Spacer />

      {/* 2. Middle Running Spinner */}
      {isRunning ? (
        <Box marginRight={2}>
          <Text bold color={colors.warning}>
            {spinnerChar} esc
          </Text>
          <Text color={colors.textDim}> interrupt</Text>
        </Box>
      ) : null}

      {/* 3. Right Token, Cost & Command Hints */}
      <Box flexDirection="row">
        <Text color={colors.textDim}>
          {tokensK}K{contextPct}
          {costDisplay}
        </Text>
        <Text bold color={colors.text}>
          {' '}
          ctrl+p
        </Text>
        <Text color={colors.textDim}> commands</Text>
      </Box>
    </Box>
  );
}
