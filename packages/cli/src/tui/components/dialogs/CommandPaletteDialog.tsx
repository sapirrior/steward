/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from './BaseDialog.js';
import type { Theme } from '../../themes/themeTypes.js';
import type { SlashCommand } from '../../commands/commandRegistry.js';

export interface CommandPaletteDialogProps {
  commands: SlashCommand[];
  selectedIndex: number;
  theme: Theme;
}

export function CommandPaletteDialog({
  commands,
  selectedIndex,
  theme,
}: CommandPaletteDialogProps) {
  const items: DialogItem[] = commands.map((cmd) => ({
    id: cmd.name,
    label: `/${cmd.name.padEnd(12)}`,
    description: cmd.description,
  }));

  return (
    <BaseDialog
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
      emptyText="No matching commands"
    />
  );
}
