/** @jsxImportSource @steward/tui */
import { SelectList } from '../../utils/select-list.js';
import type { DiscoveredModel } from '@steward/ai';
import { figures } from '@steward/app/theme/index.js';
import { c, bold } from '@steward/app/theme/style.js';
import { Box, Text } from '@steward/tui';

export interface ModelPickerProps {
  models: DiscoveredModel[] | any[];
  currentModel: { provider: string; modelId?: string; model_id?: string };
  onSelect: (model: DiscoveredModel) => void;
  onCancel: () => void;
}

export default class ModelPicker extends SelectList<any> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: ModelPickerProps) {
    const curSub = props.currentModel.modelId ?? (props.currentModel as any).model ?? props.currentModel.model_id ?? '';
    super({
      items: props.models,
      title: 'Select Model',
      subtitle: `Current: ${props.currentModel.provider}/${curSub}`,
      placeholder: 'Type to filter models…',
      emptyMessage: '  No models matching query.',
      maxVisible: 4,
      searchFilter: (m: any, q: string) => {
        const id = m.modelId || '';
        return id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
      },
      onSelect: props.onSelect,
      onCancel: props.onCancel,
      renderItem: (m: any, isSelected: boolean, maxCols: number) => {
        const isCurrent =
          m.provider === props.currentModel.provider && m.modelId === props.currentModel.modelId;

        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? bold(c.current(' (active)')) : '';
        const title = isSelected
          ? c.info(m.modelId)
          : isCurrent
            ? c.current(m.modelId)
            : c.text(m.modelId);
        const providerName = m.provider.toUpperCase();
        const caps = m.reasoning ? 'reasoning' : 'chat';
        const meta = `${providerName} • ${caps}`;

        return (
          <Box flexDirection="column" width={maxCols}>
            <Text wrap="truncate">{`${pointer}${title}${activeBadge}`}</Text>
            <Text wrap="truncate">{`  ${c.muted(meta)}`}</Text>
          </Box>
        );
      },
    });
  }
}
