/** @jsxImportSource stitchable */
import { Component, Box, Text, type InputEvent, truncateToWidth } from 'stitchable';
import { figures } from '../../../theme/figures.js';
import { c, bold } from '../../../theme/style.js';
import { renderModalBox } from '../../utils/modal-box.js';

export interface OAuthProviderItem {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected';
  account?: string;
}

export interface LoginPickerProps {
  providers: readonly OAuthProviderItem[];
  onSelect: (
    provider: OAuthProviderItem,
    callbacks: {
      onDeviceCode: (info: { userCode: string; verificationUri: string }) => void;
      onAuthUrl: (url: string) => void;
    },
  ) => Promise<string | void>;
  onClose: () => void;
}

export type LoginPickerMode = 'SELECT' | 'AUTH' | 'SUCCESS' | 'ERROR';

export interface LoginPickerState {
  mode: LoginPickerMode;
  query: string;
  selectedIndex: number;
  selectedProvider: OAuthProviderItem | null;
  spinnerFrame: number;
  authUrl?: string;
  deviceCode?: string;
  verificationUri?: string;
  statusMessage?: string;
  successMessage?: string;
  errorMessage?: string;
}

export default class LoginPicker extends Component<LoginPickerProps, LoginPickerState> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  private removeInputListener: (() => void) | null = null;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private isMountedFlag = false;

  constructor(props: LoginPickerProps) {
    super(props);
    this.state = {
      mode: 'SELECT',
      query: '',
      selectedIndex: 0,
      selectedProvider: null,
      spinnerFrame: 0,
    };
  }

  private getFilteredItems(): OAuthProviderItem[] {
    const q = this.state.query.trim().toLowerCase();
    if (!q) return [...this.props.providers];
    return this.props.providers.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }

  override componentDidMount(): void {
    this.isMountedFlag = true;
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((ev: InputEvent) => {
      const { key } = ev;

      if (this.state.mode === 'SELECT') {
        if (key.escape) {
          this.props.onClose();
          return true;
        }

        const filtered = this.getFilteredItems();

        if (key.upArrow) {
          if (filtered.length > 0) {
            const next = (this.state.selectedIndex - 1 + filtered.length) % filtered.length;
            this.setState({ selectedIndex: next });
          }
          return true;
        }
        if (key.downArrow) {
          if (filtered.length > 0) {
            const next = (this.state.selectedIndex + 1) % filtered.length;
            this.setState({ selectedIndex: next });
          }
          return true;
        }
        if (key.return) {
          if (filtered.length > 0 && this.state.selectedIndex < filtered.length) {
            this.startAuth(filtered[this.state.selectedIndex]);
          }
          return true;
        }
        if (key.backspace || key.delete) {
          if (this.state.query.length > 0) {
            this.setState({ query: this.state.query.slice(0, -1), selectedIndex: 0 });
          }
          return true;
        }
        if (ev.input && !key.ctrl && !key.meta && ev.input.length === 1) {
          this.setState({ query: this.state.query + ev.input, selectedIndex: 0 });
          return true;
        }
      } else if (this.state.mode === 'AUTH') {
        if (key.escape) {
          this.cleanupTimers();
          this.props.onClose();
          return true;
        }
      } else if (this.state.mode === 'SUCCESS' || this.state.mode === 'ERROR') {
        if (key.return || key.escape) {
          this.cleanupTimers();
          this.props.onClose();
          return true;
        }
      }

      return false;
    });
  }

  override componentWillUnmount(): void {
    this.isMountedFlag = false;
    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = null;
    }
    this.cleanupTimers();
  }

  private cleanupTimers(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
    if (this.autoCloseTimer) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
  }

  private startAuth(provider: OAuthProviderItem): void {
    this.setState({
      mode: 'AUTH',
      selectedProvider: provider,
      statusMessage: `Connecting to ${provider.name}…`,
    });

    this.spinnerTimer = setInterval(() => {
      if (this.isMountedFlag) {
        this.setState((prev) => ({
          spinnerFrame: (prev.spinnerFrame + 1) % figures.spinnerFrames.length,
        }));
      }
    }, 80);

    this.props
      .onSelect(provider, {
        onDeviceCode: (info) => {
          if (this.isMountedFlag) {
            this.setState({
              deviceCode: info.userCode,
              verificationUri: info.verificationUri,
              statusMessage: 'Waiting for device authorization in browser…',
            });
          }
        },
        onAuthUrl: (url) => {
          if (this.isMountedFlag) {
            this.setState({
              authUrl: url,
              statusMessage: 'Waiting for browser authentication…',
            });
          }
        },
      })
      .then((result) => {
        if (!this.isMountedFlag) return;
        this.cleanupTimers();
        this.setState({
          mode: 'SUCCESS',
          successMessage:
            typeof result === 'string' && result
              ? result
              : `Successfully authenticated with ${provider.name}!`,
        });
        this.autoCloseTimer = setTimeout(() => {
          if (this.isMountedFlag) {
            this.props.onClose();
          }
        }, 1400);
      })
      .catch((err) => {
        if (!this.isMountedFlag) return;
        this.cleanupTimers();
        this.setState({
          mode: 'ERROR',
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
  }

  override render(width?: number): string[] {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const {
      mode,
      selectedProvider,
      spinnerFrame,
      deviceCode,
      verificationUri,
      authUrl,
      statusMessage,
      successMessage,
      errorMessage,
    } = this.state;

    if (mode === 'AUTH') {
      const spinner = c.info(figures.spinnerFrames[spinnerFrame]);
      const content: string[] = [];

      content.push(`  ${spinner} ${bold(selectedProvider?.name ?? 'Provider')}`);
      content.push('');

      if (deviceCode && verificationUri) {
        content.push(`  ${figures.pointerSmall} Code: ${bold(deviceCode)}`);
        content.push(`  ${figures.pointerSmall} URL:  ${c.info(verificationUri)}`);
        content.push('');
        content.push(`  ${c.muted('Enter the code in your browser to complete login.')}`);
      } else if (authUrl) {
        content.push(`  ${figures.pointerSmall} URL: ${c.info(authUrl)}`);
        content.push('');
        content.push(`  ${c.muted('Browser opened. Complete authorization in your browser.')}`);
      } else {
        content.push(`  ${c.muted(statusMessage ?? 'Initiating authorization…')}`);
      }

      content.push('');

      return renderModalBox({
        title: 'Authenticating',
        subtitle: 'OAuth Flow',
        content,
        footer: 'Press Esc to cancel',
        width: termWidth,
      });
    }

    if (mode === 'SUCCESS') {
      const content: string[] = [
        `  ${c.success(figures.tick)} ${c.success(bold('Authenticated!'))}`,
        '',
        `  ${successMessage ?? `Successfully logged in to ${selectedProvider?.name}!`}`,
        '',
      ];

      return renderModalBox({
        title: 'Authentication Success',
        content,
        footer: 'Closing…',
        width: termWidth,
      });
    }

    if (mode === 'ERROR') {
      const content: string[] = [
        `  ${c.error(figures.cross)} ${c.error(bold('Authentication Failed'))}`,
        '',
        `  ${errorMessage ?? 'Unknown error occurred during login.'}`,
        '',
      ];

      return renderModalBox({
        title: 'Authentication Error',
        content,
        footer: 'Press Enter or Esc to close',
        width: termWidth,
      });
    }

    // Default SELECT mode
    const filtered = this.getFilteredItems();
    const searchLine = `> ${this.state.query ? c.text(this.state.query) : c.muted('Type to filter…')}`;

    const content: any[] = [];
    if (filtered.length === 0) {
      content.push(`  ${c.muted('No providers found.')}`);
    } else {
      for (let i = 0; i < filtered.length; i++) {
        const p = filtered[i];
        const isSelected = i === this.state.selectedIndex;
        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const isConnected = p.status === 'connected';
        const statusBadge = isConnected
          ? bold(c.current(' (connected)'))
          : c.muted(' (not connected)');

        const title = isSelected
          ? c.info(p.name)
          : isConnected
            ? c.current(p.name)
            : c.text(p.name);

        const accountInfo = p.account ? ` [${p.account}]` : '';
        const meta = `${p.description}${accountInfo}`;

        content.push(
          <Box flexDirection="column" width={maxCols}>
            <Text wrap="truncate">{`${pointer}${title}${statusBadge}`}</Text>
            <Text wrap="truncate">{`  ${c.muted(meta)}`}</Text>
          </Box>,
        );
      }
    }

    return renderModalBox({
      title: 'Login to AI Provider (OAuth)',
      subtitle: `${filtered.length} available`,
      searchLine: searchLine,
      content,
      footer: '↑/↓ navigate · Enter select · Esc cancel',
      width: termWidth,
    });
  }
}
