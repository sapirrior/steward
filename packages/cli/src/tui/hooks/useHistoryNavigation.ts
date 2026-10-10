import { useState } from 'stitchable';

export function useHistoryNavigation() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [tempDraft, setTempDraft] = useState<string>('');

  const pushToHistory = (entry: string) => {
    const trimmed = entry.trim();
    if (!trimmed) return;
    setHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);
    setTempDraft('');
  };

  const navigateUp = (currentInput: string): string | null => {
    if (history.length === 0) return null;
    if (historyIndex === -1) {
      setTempDraft(currentInput);
      const nextIndex = history.length - 1;
      setHistoryIndex(nextIndex);
      return history[nextIndex] ?? null;
    }
    if (historyIndex > 0) {
      const nextIndex = historyIndex - 1;
      setHistoryIndex(nextIndex);
      return history[nextIndex] ?? null;
    }
    return null;
  };

  const navigateDown = (): string | null => {
    if (history.length === 0 || historyIndex === -1) return null;
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      return history[nextIndex] ?? null;
    }
    if (historyIndex === history.length - 1) {
      setHistoryIndex(-1);
      return tempDraft;
    }
    return null;
  };

  const resetNavigation = () => {
    setHistoryIndex(-1);
    setTempDraft('');
  };

  return {
    pushToHistory,
    navigateUp,
    navigateDown,
    resetNavigation,
  };
}
