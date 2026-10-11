/**
 * @file usePromptHistory.ts
 * @description Command history navigation with Up/Down arrow key support and draft preservation.
 */

import { useState, useRef, useCallback } from 'stitchable';

export interface UsePromptHistoryOptions {
  maxHistory?: number;
  initialHistory?: string[];
}

export interface UsePromptHistoryReturn {
  history: string[];
  addHistory: (command: string) => void;
  navigateUp: (currentInput: string) => string | null;
  navigateDown: () => string | null;
  resetNavigation: () => void;
}

export function usePromptHistory(options: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const maxHistory = options.maxHistory ?? 100;
  const [history, setHistory] = useState<string[]>(options.initialHistory ?? []);
  const historyRef = useRef<string[]>(history);
  historyRef.current = history;

  // index in history: -1 means at the active draft line (bottom)
  // 0 to history.length - 1 represents index into history (0 is oldest, length-1 is newest)
  const historyIndexRef = useRef<number>(-1);
  const draftRef = useRef<string>('');

  const addHistory = useCallback(
    (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return;

      const current = historyRef.current;
      // Avoid immediate duplicate
      if (current.length > 0 && current[current.length - 1] === trimmed) {
        historyIndexRef.current = -1;
        draftRef.current = '';
        return;
      }

      const next = [...current, trimmed].slice(-maxHistory);
      historyRef.current = next;
      setHistory(next);
      historyIndexRef.current = -1;
      draftRef.current = '';
    },
    [maxHistory],
  );

  const navigateUp = useCallback((currentInput: string): string | null => {
    const list = historyRef.current;
    if (list.length === 0) return null;

    if (historyIndexRef.current === -1) {
      // First time pressing Up: store current input as draft
      draftRef.current = currentInput;
      historyIndexRef.current = list.length - 1;
      return list[list.length - 1] ?? null;
    }

    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      return list[historyIndexRef.current] ?? null;
    }

    // Already at oldest entry
    return list[0] ?? null;
  }, []);

  const navigateDown = useCallback((): string | null => {
    const list = historyRef.current;
    if (historyIndexRef.current === -1) {
      return null;
    }

    if (historyIndexRef.current < list.length - 1) {
      historyIndexRef.current += 1;
      return list[historyIndexRef.current] ?? null;
    }

    // Reached bottom: restore draft
    historyIndexRef.current = -1;
    return draftRef.current;
  }, []);

  const resetNavigation = useCallback(() => {
    historyIndexRef.current = -1;
    draftRef.current = '';
  }, []);

  return {
    history,
    addHistory,
    navigateUp,
    navigateDown,
    resetNavigation,
  };
}
