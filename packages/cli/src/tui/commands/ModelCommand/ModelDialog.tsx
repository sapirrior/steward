/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from '../../dialogs/BaseDialog.js';
import type { Theme } from '../../../themes/themeTypes.js';
import type { ModelMetadata } from '@steward/models';

export interface ModelDialogProps {
  models: readonly ModelMetadata[];
  selectedIndex: number;
  currentModelId?: string;
  theme: Theme;
  filterQuery?: string;
}

export function ModelDialog({
  models,
  selectedIndex,
  currentModelId,
  theme,
  filterQuery = '',
}: ModelDialogProps) {
  const filtered = filterQuery
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(filterQuery.toLowerCase()) ||
          m.provider.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : models;

  const items: DialogItem[] = filtered.map((m) => {
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
      filterQuery={filterQuery}
      placeholder="Type model or provider name..."
      emptyText="No matching models found"
    />
  );
}
