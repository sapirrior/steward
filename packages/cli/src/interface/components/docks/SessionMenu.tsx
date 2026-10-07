/** @jsxImportSource stitchable */
import { SelectList } from '../../utils/select-list.js';
import type { SessionData } from '../../../services/session/types.js';
import type { SessionTurn } from '../../../services/session/schema.js';
import { figures } from '../../../theme/figures.js';
import { c } from '../../../theme/style.js';
import { Box, Text } from 'stitchable';

export interface SessionMenuProps {
  sessions: SessionData[];
  onSelect: (session: SessionData) => void;
  onCancel: () => void;
}

function getFirstUserPrompt(turn?: SessionTurn): string {
  if (!turn) return '';
  if ((turn as any).userPrompt) return String((turn as any).userPrompt);
  const userMsg = turn.messages?.find((m) => m.role === 'user');
  if (typeof userMsg?.content === 'string') return userMsg.content;
  if (Array.isArray(userMsg?.content)) {
    const textBlock = userMsg.content.find((b: any) => b.type === 'text');
    return (textBlock as any)?.text ?? '';
  }
  return '';
}

export default class SessionMenu extends SelectList<SessionData> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: SessionMenuProps) {
    super({
      items: props.sessions,
      title: 'Resume Session',
      subtitle: `${props.sessions.length} saved`,
      placeholder: 'Type to filter…',
      emptyMessage: '  No saved sessions found.',
      maxVisible: 4,
      searchFilter: (s, q) => {
        const firstPrompt = getFirstUserPrompt(s.turns?.[0]).toLowerCase();
        const name = s.name?.toLowerCase() ?? '';
        const id = s.id?.toLowerCase() ?? '';
        return id.includes(q) || name.includes(q) || firstPrompt.includes(q);
      },
      onSelect: props.onSelect,
      onCancel: props.onCancel,
      renderItem: (s, isSelected, maxCols) => {
        const rawTitle = s.name || getFirstUserPrompt(s.turns?.[0]) || 'Untitled Session';
        const cleanTitle = rawTitle.replace(/\s+/g, ' ').trim();
        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const title = isSelected ? c.info(cleanTitle) : c.text(cleanTitle);
        const shortId = s.id.slice(0, 8);
        const dateStr = s.date ? s.date.split('T')[0] : '';
        const turnsCount = s.turns?.length ?? 0;
        const metaParts = [
          shortId,
          dateStr,
          `${turnsCount} turn${turnsCount !== 1 ? 's' : ''}`,
        ].filter(Boolean);
        const meta = metaParts.join(' • ');

        return (
          <Box flexDirection="column" width={maxCols}>
            <Text wrap="truncate">{`${pointer}${title}`}</Text>
            <Text wrap="truncate">{`  ${c.muted(meta)}`}</Text>
          </Box>
        );
      },
    });
  }
}
