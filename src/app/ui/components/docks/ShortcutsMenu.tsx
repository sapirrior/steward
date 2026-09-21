import Component from '../../../../packages/tui/src/engine/Component.js';
import { Box, Text, renderModalBox } from '../../../../packages/tui/src/primitives/index.js';
import { c } from '../../../../packages/tui/src/theme/style.js';

export interface ShortcutsMenuProps {
  onClose: () => void;
}

export default class ShortcutsMenu extends Component<ShortcutsMenuProps> {
  override wrap = false;
  override clip = true;

  private removeInputListener: (() => void) | null = null;

  override componentDidMount(): void {
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const str = chunk.toString();
      if (str === '\x1b' || str === '\r' || str === '\n') {
        this.props.onClose();
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

    const leftCol = [
      { key: '/', desc: 'Commands' },
      { key: '@', desc: 'Mention files' },
      { key: '?', desc: 'Shortcuts menu' },
      { key: 'Ctrl+B', desc: 'Switch mode' },
      { key: 'Esc Esc', desc: 'Clear input' },
    ];

    const rightCol: { key: string; desc: string }[] = [
      { key: 'Shift+Enter', desc: 'Newline' },
      { key: 'Ctrl+C', desc: 'Abort / exit' },
      { key: 'PgUp/PgDn', desc: 'Scroll history' },
      { key: '↑ / ↓', desc: 'History navigation' },
    ];

    const rows = leftCol.map((left, i) => {
      const right = rightCol[i];
      const leftFormatted = `  ${c.text(left.key.padEnd(11))} ${c.muted(left.desc.padEnd(18))}`;
      const rightFormatted = right ? `${c.text(right.key.padEnd(13))} ${c.muted(right.desc)}` : '';

      return (
        <Box direction="row" justify="start" width={maxCols}>
          <Text>{leftFormatted}</Text>
          <Text>{rightFormatted}</Text>
        </Box>
      );
    });

    return renderModalBox({
      title: 'Shortcuts',
      content: rows,
      footer: 'Esc or Enter to dismiss',
      width: termWidth,
    });
  }
}
