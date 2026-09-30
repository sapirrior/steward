/** @jsxImportSource stitchable */
import { Component, Box, Text, renderElement, parseInputChunk } from 'stitchable';
import { figures } from '../../theme/index.js';
import { c, bold, italic } from '../../theme/style.js';

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
      const rawStr = typeof chunk === 'string' ? chunk : String(chunk);
      const events = parseInputChunk(rawStr);

      for (const ev of events) {
        if (ev.key.upArrow || ev.key.downArrow) {
          this.setState({
            selectedIndex: this.state.selectedIndex === 0 ? 1 : 0,
          });
          return true;
        }

        if (ev.input === '1') {
          this.setState({ selectedIndex: 0 });
          return true;
        }

        if (ev.input === '2') {
          this.setState({ selectedIndex: 1 });
          return true;
        }

        if (ev.key.return) {
          this.props.onDecision(this.state.selectedIndex === 0);
          return true;
        }

        if (ev.key.escape) {
          this.props.onDecision(false);
          return true;
        }
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
      <Box flexDirection="column" width={maxCols}>
        <Text>{bold(c.warning('Accessing workspace:'))}</Text>
        <Text>{''}</Text>
        <Text>{bold(c.text(this.props.cwd))}</Text>
        <Text>{''}</Text>
        <Text wrap="wrap">{c.text(safetyCheckText)}</Text>
        <Text>{''}</Text>
        <Text wrap="wrap">{c.text(capabilityText)}</Text>
        <Text>{''}</Text>
        <Text>{c.muted('Security guide')}</Text>
        <Text>{''}</Text>
        <Text wrap="truncate">{yesOptionText}</Text>
        <Text wrap="truncate">{noOptionText}</Text>
        <Text>{''}</Text>
        <Text>{italic(c.muted('Enter to confirm · Esc to cancel'))}</Text>
      </Box>
    );

    return renderElement(element, { width: maxCols });
  }
}
