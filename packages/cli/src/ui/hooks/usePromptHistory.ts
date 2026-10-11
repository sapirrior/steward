/**
 * @file usePromptHistory.ts
 * @description Command history navigation with Up/Down arrow key support, draft preservation,
 * and persistent storage in ~/.steward/history.jsonl.
 */

import fs from 'node:fs';
import path from 'node:path';
import { useState, useRef, useCallback } from 'stitchable';
import { STEWARD_HISTORY_FILE } from '../../constants/index.js';

export interface UsePromptHistoryOptions {
  maxHistory?: number;
  initialHistory?: string[];
  persist?: boolean;
  historyFile?: string;
}

export interface UsePromptHistoryReturn {
  history: string[];
  addHistory: (command: string) => void;
  navigateUp: (currentInput: string) => string | null;
  navigateDown: () => string | null;
  resetNavigation: () => void;
}

/**
 * Synchronously reads the recent command history from disk.
 */
export function loadHistorySync(filePath = STEWARD_HISTORY_FILE, limit = 100): string[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: string[] = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (typeof obj === 'string') {
          parsed.push(obj);
        } else if (obj && typeof obj.command === 'string') {
          parsed.push(obj.command);
        }
      } catch {
        parsed.push(line);
      }
    }
    return parsed.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Appends a command to the persistent history file.
 */
export function appendHistorySync(command: string, filePath = STEWARD_HISTORY_FILE): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const entry = JSON.stringify({ command, timestamp: Date.now() }) + '\n';
    fs.appendFileSync(filePath, entry, 'utf-8');
  } catch {
    // Non-critical: ignore history write errors
  }
}

export function usePromptHistory(options: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const maxHistory = options.maxHistory ?? 100;
  const persist = options.persist ?? true;
  const historyFile = options.historyFile ?? STEWARD_HISTORY_FILE;

  const [history, setHistory] = useState<string[]>(() => {
    if (options.initialHistory) return options.initialHistory;
    if (persist) return loadHistorySync(historyFile, maxHistory);
    return [];
  });

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

      if (persist) {
        appendHistorySync(trimmed, historyFile);
      }
    },
    [maxHistory, persist, historyFile],
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
