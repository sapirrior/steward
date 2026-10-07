import { getActiveMode, listModes, findMode, setActiveMode } from '../../policy/index.js';
import { saveModeSelection } from '../../settings/mode.js';
import type { SlashCommand, CommandContext } from '../types.js';

export const modeCommand: SlashCommand = {
  name: 'mode',
  description: 'Switch or view the current chat mode',
  usage: '/mode [name]',
  execute: async (args: string[], _context?: CommandContext) => {
    if (args.length === 0) {
      const current = getActiveMode();
      const currentMeta = listModes().find((m) => m.name === current);
      const modeList = listModes()
        .map((m) => `  - ${m.label} (${m.name}): ${m.description}`)
        .join('\n');
      return {
        handled: true,
        message: `Current mode: ${currentMeta?.label ?? current}\n\nAvailable modes:\n${modeList}\n\nUse "/mode <name>" or press Ctrl+B to cycle modes.`,
      };
    }

    const query = args.join(' ');
    const matched = findMode(query);

    if (matched) {
      setActiveMode(matched.name);
      saveModeSelection(matched.name);
      return {
        handled: true,
        message: `Switched to ${matched.label} mode. ${matched.description}.`,
        data: {
          modeSwitched: true,
          selectedMode: matched,
        },
      };
    }

    return {
      handled: true,
      message: `Unknown mode "${query}". Valid modes are: ${listModes()
        .map((m) => m.label)
        .join(', ')}.`,
    };
  },
};
