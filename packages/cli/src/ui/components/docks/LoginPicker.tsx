/** @jsxImportSource stitchable */
import { SelectList } from '../../utils/select-list.js';
import { figures } from '../../../theme/index.js';
import { c, bold } from '../../../theme/style.js';
import { Box, Text } from 'stitchable';

export interface OAuthProviderItem {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  account?: string;
}

export interface LoginPickerProps {
  providers: readonly OAuthProviderItem[];
  onSelect: (provider: OAuthProviderItem) => void;
  onCancel: () => void;
}

export default class LoginPicker extends SelectList<OAuthProviderItem> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: LoginPickerProps) {
    super({
      items: [...props.providers],
      title: 'Login to AI Provider (OAuth)',
      subtitle: 'Select an AI provider to authenticate',
      placeholder: 'Type to filter providers…',
      emptyMessage: '  No providers found.',
      maxVisible: 4,
      searchFilter: (p: OAuthProviderItem, q: string) => {
        const lowerQ = q.toLowerCase();
        return (
          p.id.toLowerCase().includes(lowerQ) ||
          p.name.toLowerCase().includes(lowerQ) ||
          p.description.toLowerCase().includes(lowerQ)
        );
      },
      onSelect: (item: OAuthProviderItem) => {
        props.onSelect(item);
      },
      onCancel: props.onCancel,
      renderItem: (p: OAuthProviderItem, isSelected: boolean, maxCols: number) => {
        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const isConnected = p.status === 'connected';
        const statusBadge = isConnected
          ? bold(c.current(' (connected)'))
          : c.muted(' (not connected)');

        const title = isSelected
          ? c.info(p.name)
          : isConnected
            ? c.current(p.name)
            : c.text(p.name);

        const accountInfo = p.account ? ` [${p.account}]` : '';
        const meta = `${p.description}${accountInfo}`;

        return (
          <Box flexDirection="column" width={maxCols}>
            <Text wrap="truncate">{`${pointer}${title}${statusBadge}`}</Text>
            <Text wrap="truncate">{`  ${c.muted(meta)}`}</Text>
          </Box>
        );
      },
    });
  }
}
