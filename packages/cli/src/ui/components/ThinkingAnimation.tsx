/**
 * @file ThinkingAnimation.tsx
 * @description Streaming thinking animation with spinning glyph and elapsed timer.
 */

import { useState, useEffect } from 'stitchable';
import { Box, Text } from 'stitchable';
import { themeManager } from '../../themes/index.js';

export interface ThinkingAnimationProps {
  message?: string;
  startTime?: number;
}

const SPINNER_FRAMES = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];

export function ThinkingAnimation({
  message = 'Thinking…',
  startTime = Date.now(),
}: ThinkingAnimationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 150);

    return () => clearInterval(timer);
  }, [startTime]);

  const stewardColor = themeManager.getColor('steward');
  const inactiveColor = themeManager.getColor('inactive');
  const currentChar = SPINNER_FRAMES[frameIndex];

  return (
    <Box flexDirection="row" alignItems="center" marginTop={1}>
      <Text color={stewardColor} wrap="nowrap">
        {currentChar}{' '}
      </Text>
      <Text color={inactiveColor} italic wrap="nowrap">
        {message}
      </Text>
      {elapsedSeconds > 0 && (
        <Text color={inactiveColor} wrap="nowrap">
          {' '}({elapsedSeconds}s)
        </Text>
      )}
    </Box>
  );
}
