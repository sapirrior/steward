/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from '../../dialogs/BaseDialog.js';
import type { Theme } from '../../../themes/themeTypes.js';
import type { StewardSettings } from '../../../settings/settingsTypes.js';

export interface SettingsDialogProps {
  settings: StewardSettings;
  selectedIndex: number;
  theme: Theme;
}

export function SettingsDialog({ settings, selectedIndex, theme }: SettingsDialogProps) {
  const activeTools = Object.entries(settings.tools)
    .filter(([_, enabled]) => enabled)
    .map(([name]) => name)
    .join(', ');

  const items: DialogItem[] = [
    {
      id: 'provider',
      label: 'Default Provider'.padEnd(20),
      description: settings.provider,
    },
    {
      id: 'model',
      label: 'Default Model'.padEnd(20),
      description: settings.model,
    },
    {
      id: 'reasoningEffort',
      label: 'Reasoning Effort'.padEnd(20),
      description: settings.reasoningEffort,
    },
    {
      id: 'theme',
      label: 'Active Theme'.padEnd(20),
      description: settings.theme,
    },
    {
      id: 'autoApprove',
      label: 'Bash Auto-Approve'.padEnd(20),
      description: settings.bash.autoApprove ? 'enabled (unsafe)' : 'disabled (interactive prompt)',
      meta: settings.bash.autoApprove ? '[WARN]' : '[SAFE]',
    },
    {
      id: 'tools',
      label: 'Enabled Tools'.padEnd(20),
      description: activeTools || 'none',
    },
  ];

  return (
    <BaseDialog
      title="Persistent Settings (~/.steward/settings.json)"
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
      emptyText="No settings found"
    />
  );
}
