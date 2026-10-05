/** @jsxImportSource stitchable */
import { SelectList } from '../../utils/select-list.js';
import type { Model } from '@steward/ai';
import { figures, c, bold } from '../../../theme/index.js';
import { Box, Text } from 'stitchable';

export interface ModelPickerProps {
  models: readonly (Model | any)[];
  currentModel: { provider: string; modelId?: string; model_id?: string };
  onSelect: (model: { provider: string; modelId: string }) => void;
  onCancel: () => void;
}

export default class ModelPicker extends SelectList<any> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: ModelPickerProps) {
    const curSub =
      props.currentModel.modelId ??
      (props.currentModel as any).model ??
      props.currentModel.model_id ??
      '';
    super({
      items: [...props.models],
      title: 'Select Model',
      subtitle: `Current: ${props.currentModel.provider}/${curSub}`,
      placeholder: 'Type to filter models…',
      emptyMessage: '  No models matching query.',
      maxVisible: 4,
      searchFilter: (m: any, q: string) => {
        const id = m.id || m.modelId || m.model_id || '';
        const name = m.name || '';
        const provider = m.provider || '';
        const lowerQ = q.toLowerCase();
        return (
          id.toLowerCase().includes(lowerQ) ||
          name.toLowerCase().includes(lowerQ) ||
          provider.toLowerCase().includes(lowerQ)
        );
      },
      onSelect: (item: any) => {
        props.onSelect({
          provider: item.provider,
          modelId: item.id || item.modelId || item.model_id,
        });
      },
      onCancel: props.onCancel,
      renderItem: (m: any, isSelected: boolean, maxCols: number) => {
        const modelId = m.id || m.modelId || m.model_id || '';
        const isCurrent =
          m.provider === props.currentModel.provider &&
          (modelId === props.currentModel.modelId || modelId === curSub);

        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? bold(c.current(' (active)')) : '';
        const title = isSelected
          ? c.info(modelId)
          : isCurrent
            ? c.current(modelId)
            : c.text(modelId);
        const providerName = (m.provider || '').toUpperCase();
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
