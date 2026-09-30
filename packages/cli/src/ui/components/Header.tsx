/** @jsxImportSource @steward/tui */
import { homedir } from 'node:os';
import pkg from '../../../../package.json' with { type: 'json' };
import Component from '@steward/tui/engine/Component.js';
import { LOGO_LINES } from '@steward/app/theme/index.js';
import { c, bold } from '@steward/app/theme/style.js';
import { Box, Text, renderElement } from '@steward/tui';

const DEFAULT_VERSION = pkg.version || '0.0.0';

export interface HeaderProps {
  version?: string;
  cwd?: string;
  model?: {
    provider: string;
    modelId: string;
  };
}

function formatCwd(rawPath?: string): string {
  if (!rawPath) return '~';
  const home = homedir();
  if (rawPath.startsWith(home)) {
    return `~${rawPath.slice(home.length)}`;
  }
  return rawPath;
}

export function renderHeader(props: HeaderProps = {}, width: number = 80): string[] {
  const version = props.version ?? DEFAULT_VERSION;
  const logoL0 = c.brand(LOGO_LINES[0] ?? '');
  const logoL1 = c.brand(LOGO_LINES[1] ?? '');
  const logoL2 = c.brand(LOGO_LINES[2] ?? '');

  const modelObj = props.model ?? { provider: 'anthropic', modelId: 'claude-3-7-sonnet' };
  const modelTag = `${modelObj.provider}/${modelObj.modelId}`;
  const cwdFormatted = formatCwd(props.cwd ?? process.cwd());

  const element = (
    <Box flexDirection="column" width={width}>
      <Text>{`${logoL0}  ${bold(c.text('Steward'))} ${c.muted(`v${version}`)}`}</Text>
      <Text>{`${logoL1}  ${c.muted(modelTag)} ${c.muted('·')} ${c.muted('API Usage Billing')}`}</Text>
      <Text>{`${logoL2}  ${c.muted(cwdFormatted)}`}</Text>
      <Text>{''}</Text>
    </Box>
  );

  return renderElement(element, { width });
}

export default class Header extends Component<HeaderProps> {
  override wrap = false;
  override clip = false;

  override render(width?: number): string[] {
    return renderHeader(this.props, width ?? 80);
  }
}
