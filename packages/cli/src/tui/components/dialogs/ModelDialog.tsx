/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from './BaseDialog.js';
import type { Theme } from '../../themes/themeTypes.js';
import type { ModelMetadata } from '@steward/models';

export interface ModelDialogProps {
  models: readonly ModelMetadata[];
  selectedIndex: number;
  currentModelId?: string;
  theme: Theme;
}

export function ModelDialog({ models, selectedIndex, currentModelId, theme }: ModelDialogProps) {
  const items: DialogItem[] = models.map((m) => {
    const isCurrent = currentModelId === m.id;
    const ctx = m.contextWindow ? `${Math.round(m.contextWindow / 1000)}k` : '';
    const meta = [ctx, isCurrent ? '(current)' : ''].filter(Boolean).join(' ');

    return {
      id: `${m.provider}/${m.id}`,
      label: m.id.length > 32 ? m.id.slice(0, 30) + '..' : m.id.padEnd(32),
      description: m.provider,
      meta,
    };
  });

  return (
    <BaseDialog
      title="Select Model"
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
      emptyText="No models found"
    />
  );
}
