/** @jsxImportSource stitchable */
import { SelectList } from '../../utils/select-list.js';
import type { ThemeMeta } from '../../../theme/colors.js';
import { figures, resolveThemeColor } from '../../../theme/index.js';
import { c, bold } from '../../../theme/style.js';
import { Box, Text } from 'stitchable';

export interface ThemePickerProps {
  themes: ThemeMeta[];
  currentTheme: string;
  onSelect: (theme: ThemeMeta) => void;
  onCancel: () => void;
}

export default class ThemePicker extends SelectList<ThemeMeta> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  constructor(props: ThemePickerProps) {
    const currentMeta = props.themes.find((t) => t.name === props.currentTheme);
    const subtitle = currentMeta
      ? `Current: ${currentMeta.label}`
      : `Current: ${props.currentTheme}`;

    super({
      items: props.themes,
      title: 'Select Theme',
      subtitle,
      placeholder: 'Type to filter themes…',
      emptyMessage: '  No themes matching query.',
      maxVisible: 4,
      searchFilter: (t, q) =>
        t.name.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
      onSelect: props.onSelect,
      onCancel: props.onCancel,
      renderItem: (t, isSelected, maxCols) => {
        const isCurrent = t.name === props.currentTheme;

        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? bold(c.current(' (active)')) : '';
        const title = isSelected
          ? c.info(t.label)
          : isCurrent
            ? c.current(t.label)
            : c.text(t.label);

        // Swatch line using the candidate theme's own color palette
        const tBrand = resolveThemeColor(t.theme.brand, false)(figures.blackCircle);
        const tSuccess = resolveThemeColor(t.theme.success, false)(figures.blackCircle);
        const tWarning = resolveThemeColor(t.theme.warning, false)(figures.blackCircle);
        const tError = resolveThemeColor(t.theme.error, false)(figures.blackCircle);
        const tInfo = resolveThemeColor(t.theme.info, false)(figures.blackCircle);
        const tPerm = resolveThemeColor(t.theme.permission, false)(figures.blackCircle);
        const swatches = `  ${tBrand} ${tSuccess} ${tWarning} ${tError} ${tInfo} ${tPerm}  ${t.description}`;

        return (
          <Box flexDirection="column" width={maxCols}>
            <Text wrap="truncate">{`${pointer}${title}${activeBadge}`}</Text>
            <Text wrap="truncate">{swatches}</Text>
          </Box>
        );
      },
    });
  }
}
