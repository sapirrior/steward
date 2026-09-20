import { SelectList } from '../../primitives/index.js';
import type { ThemeMeta, ThemeName } from '../../../theme/colors.js';
import { getTheme, figures, resolveThemeColor } from '../../../theme/index.js';
import { themeColor, chalk } from '../../utils/format.js';
import { Box, Text } from '../../primitives/index.js';

export interface ThemePickerProps {
  themes: ThemeMeta[];
  currentTheme: ThemeName;
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
        const theme = getTheme();
        const selColor = themeColor(theme.permission);
        const yellowColor = themeColor(theme.warning);
        const isCurrent = t.name === props.currentTheme;

        const pointer = isSelected ? selColor(`${figures.pointer} `) : '  ';
        const activeBadge = isCurrent ? yellowColor.bold(' (active)') : '';

        // Swatch line using the candidate theme's own color palette
        const tBrand = resolveThemeColor(t.theme.brand, false)(figures.blackCircle);
        const tSuccess = resolveThemeColor(t.theme.success, false)(figures.blackCircle);
        const tWarning = resolveThemeColor(t.theme.warning, false)(figures.blackCircle);
        const tError = resolveThemeColor(t.theme.error, false)(figures.blackCircle);
        const tInfo = resolveThemeColor(t.theme.info, false)(figures.blackCircle);
        const tPerm = resolveThemeColor(t.theme.permission, false)(figures.blackCircle);
        const swatches = `  ${tBrand} ${tSuccess} ${tWarning} ${tError} ${tInfo} ${tPerm}  ${t.description}`;

        return (
          <Box direction="column" width={maxCols}>
            <Text
              color={isSelected ? selColor : isCurrent ? yellowColor : chalk.white}
              wrap={false}
              clip={true}
              ellipsis={true}
            >
              {`${pointer}${t.label}${activeBadge}`}
            </Text>
            <Text dim={true} wrap={false} clip={true} ellipsis={true}>
              {swatches}
            </Text>
          </Box>
        );
      },
    });
  }
}
