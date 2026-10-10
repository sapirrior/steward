export interface SlashCommand {
  name: string;
  description: string;
  aliases?: string[];
  execute: (args: string) => Promise<void> | void;
}

export const BUILTIN_COMMANDS: SlashCommand[] = [
  {
    name: 'new',
    aliases: ['clear', 'reset'],
    description: 'Start a new session / reset conversation thread',
    execute: () => {},
  },
  {
    name: 'model',
    description: 'Switch active AI model reference',
    execute: () => {},
  },
  {
    name: 'effort',
    description: 'Set reasoning effort: none, low, medium, high, max',
    execute: () => {},
  },
  {
    name: 'theme',
    description: 'Switch visual theme (default, github)',
    execute: () => {},
  },
  {
    name: 'resume',
    description: 'Resume a saved conversation thread',
    execute: () => {},
  },
  {
    name: 'compact',
    description: 'Compact conversation context',
    execute: () => {},
  },
  {
    name: 'settings',
    aliases: ['config'],
    description: 'Display persistent settings from ~/.steward/settings.json',
    execute: () => {},
  },
  {
    name: 'exit',
    aliases: ['quit', 'q'],
    description: 'Exit Steward TUI session',
    execute: () => {},
  },
];
