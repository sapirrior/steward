/** @jsxImportSource stitchable */
import { BaseDialog, type DialogItem } from './BaseDialog.js';
import type { Theme } from '../../themes/themeTypes.js';
import type { ThreadSummary } from '@steward/threads';

export interface ResumeDialogProps {
  threads: readonly ThreadSummary[];
  selectedIndex: number;
  theme: Theme;
}

function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ResumeDialog({ threads, selectedIndex, theme }: ResumeDialogProps) {
  const items: DialogItem[] = threads.map((t) => {
    const title = t.title || 'Untitled Thread';
    const label = title.length > 28 ? title.slice(0, 26) + '..' : title.padEnd(28);
    const meta = `${t.model.modelId} · ${formatRelativeTime(t.updatedAt)}`;

    return {
      id: t.id,
      label,
      description: `${t.messageCount} msg${t.messageCount === 1 ? '' : 's'}`,
      meta,
    };
  });

  return (
    <BaseDialog
      title="Resume Session Thread"
      items={items}
      selectedIndex={selectedIndex}
      theme={theme}
      emptyText="No saved threads found"
    />
  );
}
