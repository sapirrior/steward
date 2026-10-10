/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from './BaseDialog.js';
import type { Theme } from '../../themes/themeTypes.js';

export interface ThemeDialogProps {
  currentThemeName: string;
  selectedIndex: number;
  theme: Theme;
}

const THEME_OPTIONS: { name: string; description: string }[] = [
  { name: 'default', description: 'Modern dark theme with high contrast card surfaces' },
  { name: 'github', description: 'GitHub Dark modern aesthetic' },
];

export function ThemeDialog({ currentThemeName, selectedIndex, theme }: ThemeDialogProps) {
  const items: DialogItem[] = THEME_OPTIONS.map((opt) => ({
    id: opt.name,
    label: opt.name.padEnd(12),
    description: opt.description,
    meta: opt.name === currentThemeName ? '(current)' : undefined,
  }));

  return (
    <BaseDialog title="Switch Theme" items={items} selectedIndex={selectedIndex} theme={theme} />
  );
}
