import { SelectList } from '@steward/tui/primitives/index.js';
import type { DiscoveredModel } from '@steward/ai';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import { Box, Text } from '@steward/tui/primitives/index.js';

export interface ModelPickerProps {
  models: DiscoveredModel[];
  currentModel: { provider: string; modelId: string };
  onSelect: (model: DiscoveredModel) => void;
  onCancel: () => void;
}

export default class ModelPicker extends SelectList<DiscoveredModel> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: ModelPickerProps) {
    super({
      items: props.models,
      title: 'Select Model',
      subtitle: `Current: ${props.currentModel.provider}/${props.currentModel.modelId}`,
      placeholder: 'Type to filter models…',
      emptyMessage: '  No models matching query.',
      maxVisible: 4,
      searchFilter: (m, q) =>
        m.modelId.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
      onSelect: props.onSelect,
      onCancel: props.onCancel,
      renderItem: (m, isSelected, maxCols) => {
        const isCurrent =
          m.provider === props.currentModel.provider && m.modelId === props.currentModel.modelId;

        const pointer = isSelected ? c.selected(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? bold(c.current(' (active)')) : '';
        const providerName = m.provider.toUpperCase();
        const caps = m.reasoning ? 'reasoning' : 'chat';
        const meta = `${providerName} • ${caps}`;

        return (
          <Box direction="column" width={maxCols}>
            <Text
              color={isSelected ? 'selected' : isCurrent ? 'current' : 'text'}
              wrap={false}
              clip={true}
              ellipsis={true}
            >
              {`${pointer}${m.modelId}${activeBadge}`}
            </Text>
            <Text color="muted" wrap={false} clip={true} ellipsis={true}>
              {`  ${meta}`}
            </Text>
          </Box>
        );
      },
    });
  }
}
