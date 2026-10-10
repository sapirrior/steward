import { useEffect, useState } from 'stitchable';
import { getSpinnerFrames } from '../../constants/icons.js';

/**
 * Animated flower-growth spinner hook consuming SPINNER_FRAMES from constants.
 */
export function useSpinner(isRunning: boolean = false, intervalMs: number = 100): string {
  const frames = getSpinnerFrames();
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setFrameIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, frames.length, intervalMs]);

  return frames[frameIndex] ?? frames[0] ?? '✢';
}
