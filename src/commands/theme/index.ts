import { listThemes, getActiveThemeName, setActiveTheme, findTheme } from '../../theme/index.js';
import { saveThemeSelection } from '../../config/index.js';
import type { CommandContext, CommandResult, SlashCommand } from '../types.js';

/**
 * /theme slash command: opens interactive theme picker dock when invoked with no args,
 * or switches theme directly and persists preference to ~/.steward/settings.json.
 */
export const themeCommand: SlashCommand = {
  name: 'theme',
  description: 'View or switch the active UI color theme with interactive theme picker',
  usage: '/theme [theme_name]',

  async execute(args: string[], _context: CommandContext): Promise<CommandResult> {
    // 1. If no args provided, trigger interactive ThemePicker dock
    if (args.length === 0) {
      return {
        handled: true,
        data: {
          showThemePicker: true,
          themes: listThemes(),
          current: getActiveThemeName(),
        },
      };
    }

    // 2. Direct theme switch
    const matched = findTheme(args.join(' '));

    if (!matched) {
      const validNames = listThemes()
        .map((t) => t.name)
        .join(', ');
      return {
        handled: true,
        message: `Theme "${args.join(' ')}" was not found.\nAvailable themes: ${validNames}.\nType "/theme" to open the interactive theme picker.`,
      };
    }

    // 3. Apply and persist
    setActiveTheme(matched.name);
    saveThemeSelection(matched.name);

    return {
      handled: true,
      message: `Active theme switched to ${matched.label} and saved to ~/.steward/settings.json.`,
      data: { selected: matched, themeSwitched: true },
    };
  },
};
