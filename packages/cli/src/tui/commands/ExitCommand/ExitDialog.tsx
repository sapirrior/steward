/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from '../../dialogs/BaseDialog.js';
import type { Theme } from '../../../themes/themeTypes.js';

export interface ExitDialogProps {
  selectedIndex: number;
  theme: Theme;
}

export function ExitDialog({ selectedIndex, theme }: ExitDialogProps) {
  const items: DialogItem[] = [
    {
      id: 'confirm',
      label: 'Exit Steward'.padEnd(16),
      description: 'Save active session thread and restore terminal',
      meta: '[Enter]',
    },
    {
      id: 'cancel',
      label: 'Cancel'.padEnd(16),
      description: 'Return to active chat session',
      meta: '[Esc]',
    },
  ];

  return (
    <BaseDialog
      title="Exit Session Confirmation"
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
      emptyText=""
    />
  );
}
