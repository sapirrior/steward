import { homedir } from 'node:os';
import pkg from '../../../../package.json' with { type: 'json' };
import Component from '@steward/tui/engine/Component.js';
import { LOGO_LINES } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import { Box, Text } from '@steward/tui/primitives/index.js';

const DEFAULT_VERSION = pkg.version || '0.0.0';

export interface HeaderProps {
  version?: string;
  cwd?: string;
  model?: {
    provider: string;
    modelId: string;
  };
}

export default class Header extends Component<HeaderProps> {
  override wrap = false;
  override clip = false;

  private formatCwd(rawPath?: string): string {
    if (!rawPath) return '~';
    const home = homedir();
    if (rawPath.startsWith(home)) {
      return `~${rawPath.slice(home.length)}`;
    }
    return rawPath;
  }

  override render(_width?: number): string[] {
    const version = this.props.version ?? DEFAULT_VERSION;
    const logoL0 = c.brand(LOGO_LINES[0] ?? '');
    const logoL1 = c.brand(LOGO_LINES[1] ?? '');
    const logoL2 = c.brand(LOGO_LINES[2] ?? '');

    const modelObj = this.props.model ?? { provider: 'anthropic', modelId: 'claude-3-7-sonnet' };
    const modelTag = `${modelObj.provider}/${modelObj.modelId}`;
    const cwdFormatted = this.formatCwd(this.props.cwd ?? process.cwd());

    const element = (
      <Box direction="column" wrap={false} clip={false}>
        <Text wrap={false} clip={false}>
          {`${logoL0}  ${bold(c.text('Steward'))} ${c.muted(`v${version}`)}`}
        </Text>
        <Text wrap={false} clip={false}>
          {`${logoL1}  ${c.muted(modelTag)} ${c.muted('·')} ${c.muted('API Usage Billing')}`}
        </Text>
        <Text wrap={false} clip={false}>
          {`${logoL2}  ${c.muted(cwdFormatted)}`}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
      </Box>
    );

    return element.render(80);
  }
}
