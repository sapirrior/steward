import Component from '@steward/tui/engine/Component.js';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold, italic } from '@steward/tui/theme/style.js';
import { Box, Text, parseKeyInput } from '@steward/tui/primitives/index.js';

export interface TrustGateProps {
  cwd: string;
  onDecision: (trusted: boolean) => void;
}

export interface TrustGateState {
  selectedIndex: number;
}

export default class TrustGate extends Component<TrustGateProps, TrustGateState> {
  override wrap = true;
  override clip = false;

  private removeInputListener: (() => void) | null = null;

  constructor(props: TrustGateProps) {
    super(props);
    this.state = {
      selectedIndex: 1, // Default to option 1 ("2. No, exit")
    };
  }

  override componentDidMount(): void {
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);
      const rawStr = chunk.toString();

      if (action.type === 'cursor-up' || action.type === 'cursor-down') {
        this.setState({
          selectedIndex: this.state.selectedIndex === 0 ? 1 : 0,
        });
        return true;
      }

      if (rawStr === '1') {
        this.setState({ selectedIndex: 0 });
        return true;
      }

      if (rawStr === '2') {
        this.setState({ selectedIndex: 1 });
        return true;
      }

      if (action.type === 'submit') {
        this.props.onDecision(this.state.selectedIndex === 0);
        return true;
      }

      if (action.type === 'escape') {
        this.props.onDecision(false);
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
    const isYesSelected = selectedIndex === 0;
    const isNoSelected = selectedIndex === 1;

    const pointer = figures.pointer ?? '>';

    const yesOptionText = isYesSelected
      ? `${c.permission(pointer)} ${bold(c.permission('1. Yes, I trust this folder'))}`
      : `  ${c.text('1. Yes, I trust this folder')}`;

    const noOptionText = isNoSelected
      ? `${c.permission(pointer)} ${bold(c.permission('2. No, exit'))}`
      : `  ${c.text('2. No, exit')}`;

    const safetyCheckText =
      'You should only proceed if you trust this workspace. Accessing untrusted workspaces may allow malicious code in the repository to compromise security or mislead the assistant.';

    const capabilityText =
      'Steward can read files and execute commands to investigate, build, and debug with your explicit permission. Pre-mutation checkpoints ensure every edit is reversible via /rewind.';

    const element = (
      <Box direction="column" width={maxCols} wrap={true} clip={false}>
        <Text wrap={false} clip={false}>
          {bold(c.warning('Accessing workspace:'))}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {bold(c.text(this.props.cwd))}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={true}>{c.text(safetyCheckText)}</Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={true}>{c.text(capabilityText)}</Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {c.muted('Security guide')}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {yesOptionText}
        </Text>
        <Text wrap={false} clip={false}>
          {noOptionText}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {italic(c.muted('Enter to confirm · Esc to cancel'))}
        </Text>
      </Box>
    );

    return element.render(maxCols);
  }
}
