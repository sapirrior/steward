/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from './BaseDialog.js';
import type { Theme } from '../../themes/themeTypes.js';
import type { ReasoningEffort } from '../../agent/types.js';

export interface EffortDialogProps {
  currentEffort: ReasoningEffort;
  selectedIndex: number;
  theme: Theme;
}

const EFFORT_OPTIONS: { level: ReasoningEffort; description: string }[] = [
  { level: 'none', description: 'Disable reasoning / thinking tokens completely' },
  { level: 'low', description: 'Fast reasoning with minimal thinking tokens' },
  { level: 'medium', description: 'Balanced reasoning for typical engineering tasks' },
  { level: 'high', description: 'Deep reasoning with extended thinking tokens' },
  { level: 'max', description: 'Maximum thinking effort budget for complex problems' },
];

export function EffortDialog({ currentEffort, selectedIndex, theme }: EffortDialogProps) {
  const items: DialogItem[] = EFFORT_OPTIONS.map((opt) => ({
    id: opt.level,
    label: opt.level.padEnd(10),
    description: opt.description,
    meta: opt.level === currentEffort ? '(current)' : undefined,
  }));

  return (
    <BaseDialog
      title="Set Reasoning Effort"
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
    />
  );
}
