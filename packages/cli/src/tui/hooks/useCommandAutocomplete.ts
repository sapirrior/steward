import { useState, useMemo } from 'stitchable';
import { BUILTIN_COMMANDS, type SlashCommand } from '../commands/commandRegistry.js';

export interface UseCommandAutocompleteResult {
  isOpen: boolean;
  query: string;
  matchedCommands: SlashCommand[];
  selectedIndex: number;
  selectNext: () => void;
  selectPrev: () => void;
  getSelectedCommand: () => SlashCommand | undefined;
  reset: () => void;
}

export function useCommandAutocomplete(inputText: string): UseCommandAutocompleteResult {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const trimmed = inputText.trim();
  const isOpen = trimmed.startsWith('/') && !trimmed.includes(' ');
  const query = isOpen ? trimmed.slice(1).toLowerCase() : '';

  const matchedCommands = useMemo(() => {
    if (!isOpen) return [];
    if (!query) return BUILTIN_COMMANDS;
    return BUILTIN_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.aliases?.some((a) => a.toLowerCase().includes(query)),
    );
  }, [isOpen, query]);

  const selectNext = () => {
    if (matchedCommands.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % matchedCommands.length);
  };

  const selectPrev = () => {
    if (matchedCommands.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + matchedCommands.length) % matchedCommands.length);
  };

  const getSelectedCommand = () => {
    return matchedCommands[selectedIndex];
  };

  const reset = () => {
    setSelectedIndex(0);
  };

  return {
    isOpen: isOpen && matchedCommands.length > 0,
    query,
    matchedCommands,
    selectedIndex: Math.min(selectedIndex, Math.max(0, matchedCommands.length - 1)),
    selectNext,
    selectPrev,
    getSelectedCommand,
    reset,
  };
}
