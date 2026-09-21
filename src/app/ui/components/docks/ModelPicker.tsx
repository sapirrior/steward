import { SelectList } from '../../../../packages/tui/src/primitives/index.js';
import type { ModelDescriptor } from '../../../../packages/agents/src/models/discovery.js';
import { figures } from '../../../../packages/tui/src/theme/index.js';
import { c, bold } from '../../../../packages/tui/src/theme/style.js';
import { Box, Text } from '../../../../packages/tui/src/primitives/index.js';

export interface ModelPickerProps {
  models: ModelDescriptor[];
  currentModel: { provider: string; modelId: string };
  onSelect: (model: ModelDescriptor) => void;
  onCancel: () => void;
}

export default class ModelPicker extends SelectList<ModelDescriptor> {
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
        m.model_id.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q),
      onSelect: props.onSelect,
      onCancel: props.onCancel,
      renderItem: (m, isSelected, maxCols) => {
        const isCurrent =
          m.provider === props.currentModel.provider && m.model_id === props.currentModel.modelId;

        const pointer = isSelected ? c.selected(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? bold(c.current(' (active)')) : '';
        const providerName = m.provider.toUpperCase();
        const caps = m.capabilities?.reasoning ? 'reasoning' : 'chat';
        const meta = `${providerName} • ${caps}`;

        return (
          <Box direction="column" width={maxCols}>
            <Text
              color={isSelected ? 'selected' : isCurrent ? 'current' : 'text'}
              wrap={false}
              clip={true}
              ellipsis={true}
            >
              {`${pointer}${m.model_id}${activeBadge}`}
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
