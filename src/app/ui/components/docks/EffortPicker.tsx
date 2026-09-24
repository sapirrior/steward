import Component from '@steward/tui/engine/Component.js';
import type { ReasoningEffort } from '@steward/ai';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import { Box, Text, renderModalBox, parseKeyInput } from '@steward/tui/primitives/index.js';

export interface EffortOption {
  id: ReasoningEffort;
  label: string;
  badge: string;
  description: string;
}

export const EFFORT_OPTIONS: EffortOption[] = [
  { id: 'none', label: 'none', badge: 'none', description: 'No thinking' },
  { id: 'low', label: 'low', badge: 'low', description: 'Fast thinking' },
  { id: 'medium', label: 'medium', badge: 'medium', description: 'Balanced' },
  { id: 'high', label: 'high', badge: 'high', description: 'Thorough' },
];

export interface EffortPickerProps {
  currentEffort: ReasoningEffort;
  onSelect: (effort: ReasoningEffort, persist: boolean) => void;
  onCancel: () => void;
}

export interface EffortPickerState {
  selectedIndex: number;
}

export default class EffortPicker extends Component<EffortPickerProps, EffortPickerState> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  private removeInputListener: (() => void) | null = null;

  constructor(props: EffortPickerProps) {
    super(props);
    const initialIndex = EFFORT_OPTIONS.findIndex((opt) => opt.id === props.currentEffort);
    this.state = {
      selectedIndex: initialIndex !== -1 ? initialIndex : 2, // default to 'medium'
    };
  }

  override componentDidMount(): void {
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);
      const rawStr = chunk.toString();

      if (action.type === 'cursor-left') {
        this.setState({
          selectedIndex: Math.max(0, this.state.selectedIndex - 1),
        });
        return true;
      }

      if (action.type === 'cursor-right') {
        this.setState({
          selectedIndex: Math.min(EFFORT_OPTIONS.length - 1, this.state.selectedIndex + 1),
        });
        return true;
      }

      if (action.type === 'submit') {
        const chosen = EFFORT_OPTIONS[this.state.selectedIndex];
        if (chosen) {
          this.props.onSelect(chosen.id, true);
        }
        return true;
      }

      if (rawStr === 's' || rawStr === 'S') {
        const chosen = EFFORT_OPTIONS[this.state.selectedIndex];
        if (chosen) {
          this.props.onSelect(chosen.id, false);
        }
        return true;
      }

      if (action.type === 'escape') {
        this.props.onCancel();
        return true;
      }

      return false;
    });
  }

  override componentWillUnmount(): void {
    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = null;
    }
  }

  override render(width?: number): string[] {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const { selectedIndex } = this.state;
    const activeOption = EFFORT_OPTIONS[selectedIndex] ?? EFFORT_OPTIONS[0]!;

    const leftPad = 4;
    const availableWidth = Math.max(20, maxCols - leftPad * 2);
    const colWidth = Math.max(5, Math.min(14, Math.floor(availableWidth / EFFORT_OPTIONS.length)));
    const totalSliderCols = colWidth * EFFORT_OPTIONS.length;

    const fasterText = 'Faster';
    const smarterText = 'Smarter';
    const spectrumGap = Math.max(1, totalSliderCols - (fasterText.length + smarterText.length));
    const spectrumRow = `${' '.repeat(leftPad)}${bold(c.info(fasterText))}${' '.repeat(spectrumGap)}${bold(c.permission(smarterText))}`;

    let trackChars = '';
    for (let i = 0; i < EFFORT_OPTIONS.length; i++) {
      const isSelected = i === selectedIndex;
      const opt = EFFORT_OPTIONS[i]!;
      const isCurrent = opt.id === this.props.currentEffort;
      const pointerColor = isCurrent ? c.current : c.permission;

      const slotCenter = Math.floor(colWidth / 2);
      for (let ch = 0; ch < colWidth; ch++) {
        if (ch === slotCenter) {
          if (isSelected) {
            trackChars += pointerColor(figures.sliderPointer ?? '▲');
          } else {
            trackChars += c.promptBorder(figures.horizontalLine);
          }
        } else {
          trackChars += c.promptBorder(figures.horizontalLine);
        }
      }
    }
    const trackRow = `${' '.repeat(leftPad)}${trackChars}`;

    let labelCols = '';
    for (let i = 0; i < EFFORT_OPTIONS.length; i++) {
      const opt = EFFORT_OPTIONS[i]!;
      const isSelected = i === selectedIndex;
      const isCurrent = opt.id === this.props.currentEffort;

      let labelText = opt.label;
      if (isSelected && isCurrent) {
        labelText = bold(c.current(labelText));
      } else if (isSelected) {
        labelText = bold(c.permission(labelText));
      } else if (isCurrent) {
        labelText = bold(c.current(labelText));
      } else {
        labelText = c.text(labelText);
      }

      const textLen = opt.label.length;
      const padLeft = Math.floor((colWidth - textLen) / 2);
      const padRight = Math.max(0, colWidth - textLen - padLeft);
      labelCols += `${' '.repeat(Math.max(0, padLeft))}${labelText}${' '.repeat(Math.max(0, padRight))}`;
    }
    const labelsRow = `${' '.repeat(leftPad)}${labelCols}`;

    const descText = `    ${bold(c.text(activeOption.description))}`;

    const contentElements = [
      <Box direction="column" width={maxCols} clip={true}>
        <Text clip={true}>{spectrumRow}</Text>
        <Text clip={true}>{trackRow}</Text>
        <Text clip={true}>{labelsRow}</Text>
        <Text clip={true}>{descText}</Text>
      </Box>,
    ];

    return renderModalBox({
      title: 'Effort Level',
      subtitle: `Current: ${this.props.currentEffort}`,
      content: contentElements,
      footer: '←/→ adjust · Enter save · s session · Esc cancel',
      width: termWidth,
    });
  }
}
