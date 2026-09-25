import Component from '@steward/tui/engine/Component.js';
import type { AuthEvent, AuthManager, AuthPrompt, ProviderId } from '@steward/ai';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import { Box, Text, renderModalBox, parseKeyInput } from '@steward/tui/primitives/index.js';
import { openUrl } from '../../../utils/open-url.js';

export interface OAuthProviderOption {
  id: ProviderId;
  name: string;
  description: string;
}

export const OAUTH_PROVIDERS: OAuthProviderOption[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude Pro / Max subscription login via browser',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'OAuth PKCE key generation via browser',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    description: 'GitHub Copilot device code authorization',
  },
];

export interface LoginDockProps {
  authManager: AuthManager;
  targetProvider?: ProviderId;
  onSuccess: (provider: ProviderId) => void;
  onCancel: () => void;
}

export type LoginDockStep =
  'select-provider' | 'starting' | 'waiting-for-browser' | 'exchanging' | 'success' | 'error';

export interface LoginDockState {
  step: LoginDockStep;
  selectedIndex: number;
  authUrl?: string;
  userCode?: string;
  progressMessage?: string;
  errorMessage?: string;
  manualCodeInput: string;
  isManualPrompt: boolean;
  manualPromptMessage?: string;
}

export default class LoginDock extends Component<LoginDockProps, LoginDockState> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  private abortController = new AbortController();
  private removeInputListener: (() => void) | null = null;
  private manualPromptResolver: ((code: string) => void) | null = null;

  constructor(props: LoginDockProps) {
    super(props);

    if (
      props.targetProvider &&
      (props.targetProvider === 'anthropic' || props.targetProvider === 'openrouter')
    ) {
      this.state = {
        step: 'starting',
        selectedIndex: props.targetProvider === 'openrouter' ? 1 : 0,
        manualCodeInput: '',
        isManualPrompt: false,
      };
    } else {
      this.state = {
        step: 'select-provider',
        selectedIndex: 0,
        manualCodeInput: '',
        isManualPrompt: false,
      };
    }
  }

  override componentDidMount(): void {
    if (!this.engine) return;

    if (this.state.step === 'starting') {
      const target = this.props.targetProvider ?? 'anthropic';
      void this.startLogin(target);
    }

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);
      const rawStr = chunk.toString();

      if (action.type === 'escape') {
        this.abortController.abort();
        this.props.onCancel();
        return true;
      }

      if (this.state.step === 'select-provider') {
        if (action.type === 'cursor-up') {
          this.setState({
            selectedIndex: Math.max(0, this.state.selectedIndex - 1),
          });
          return true;
        }

        if (action.type === 'cursor-down') {
          this.setState({
            selectedIndex: Math.min(OAUTH_PROVIDERS.length - 1, this.state.selectedIndex + 1),
          });
          return true;
        }

        if (action.type === 'submit') {
          const chosen = OAUTH_PROVIDERS[this.state.selectedIndex];
          if (chosen) {
            void this.startLogin(chosen.id);
          }
          return true;
        }
      }

      if (this.state.isManualPrompt) {
        if (action.type === 'submit') {
          if (this.state.manualCodeInput.trim() && this.manualPromptResolver) {
            this.manualPromptResolver(this.state.manualCodeInput.trim());
            this.manualPromptResolver = null;
            this.setState({ isManualPrompt: false });
          }
          return true;
        }

        if (action.type === 'backspace') {
          this.setState({
            manualCodeInput: this.state.manualCodeInput.slice(0, -1),
          });
          return true;
        }

        if (rawStr.length === 1 && rawStr.charCodeAt(0) >= 32) {
          this.setState({
            manualCodeInput: this.state.manualCodeInput + rawStr,
          });
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
    this.abortController.abort();
  }

  private async startLogin(provider: ProviderId): Promise<void> {
    this.setState({
      step: 'waiting-for-browser',
      progressMessage: `Opening browser for ${provider}...`,
    });

    try {
      await this.props.authManager.login(provider, {
        signal: this.abortController.signal,
        prompt: (prompt: AuthPrompt): Promise<string> => {
          if (prompt.type === 'manual-code') {
            this.setState({
              isManualPrompt: true,
              manualPromptMessage: prompt.message,
              manualCodeInput: '',
            });
            return new Promise<string>((resolve) => {
              this.manualPromptResolver = resolve;
            });
          }
          return Promise.resolve('');
        },
        notify: (event: AuthEvent) => {
          if (event.type === 'auth-url') {
            this.setState({
              authUrl: event.url,
              progressMessage: 'Browser opened. Awaiting login authorization...',
            });
            openUrl(event.url);
          } else if (event.type === 'device-code') {
            this.setState({
              authUrl: event.verificationUri,
              userCode: event.userCode,
              progressMessage: `Enter code "${event.userCode}" in your browser to authorize.`,
            });
            openUrl(event.verificationUri);
          } else if (event.type === 'progress') {
            this.setState({ progressMessage: event.message });
          }
        },
      });

      this.setState({ step: 'success' });
      setTimeout(() => {
        this.props.onSuccess(provider);
      }, 800);
    } catch (err: any) {
      if (this.abortController.signal.aborted) {
        return;
      }
      this.setState({
        step: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  override render(width?: number): string[] {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const {
      step,
      selectedIndex,
      progressMessage,
      authUrl,
      userCode,
      errorMessage,
      isManualPrompt,
      manualCodeInput,
    } = this.state;

    const contentElements: any[] = [];

    if (step === 'select-provider') {
      const items = OAUTH_PROVIDERS.map((p, idx) => {
        const isSelected = idx === selectedIndex;
        const pointer = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const name = isSelected ? c.info(bold(p.name)) : c.text(bold(p.name));
        return (
          <Box direction="column" width={maxCols} key={p.id}>
            <Text>{`${pointer}${name}`}</Text>
            <Text color="muted">{`    ${p.description}`}</Text>
          </Box>
        );
      });

      contentElements.push(
        <Box direction="column" width={maxCols}>
          {items}
        </Box>,
      );
    } else if (step === 'waiting-for-browser' || step === 'starting' || step === 'exchanging') {
      contentElements.push(
        <Box direction="column" width={maxCols}>
          <Text color="info">{`${figures.pointer} ${progressMessage || 'Waiting for browser authorization...'}`}</Text>
          {userCode ? (
            <Box direction="column" width={maxCols}>
              <Text color="warning">{`One-time code: ${bold(userCode)}`}</Text>
            </Box>
          ) : null}
          {authUrl ? (
            <Box direction="column" width={maxCols}>
              <Text color="muted">If browser did not open, navigate to:</Text>
              <Text color="permission" ellipsis={true} wrap={false}>
                {authUrl}
              </Text>
            </Box>
          ) : null}
          {isManualPrompt ? (
            <Box direction="column" width={maxCols}>
              <Text color="warning">Paste authorization code / URL below and press Enter:</Text>
              <Text color="selected">{`> ${manualCodeInput}_`}</Text>
            </Box>
          ) : null}
        </Box>,
      );
    } else if (step === 'success') {
      contentElements.push(
        <Box direction="column" width={maxCols}>
          <Text color="success">{`${figures.tick} Successfully authenticated!`}</Text>
        </Box>,
      );
    } else if (step === 'error') {
      contentElements.push(
        <Box direction="column" width={maxCols}>
          <Text color="error">{`${figures.cross} Authentication failed:`}</Text>
          <Text color="text">{`  ${errorMessage || 'Unknown error'}`}</Text>
        </Box>,
      );
    }

    return renderModalBox({
      title: 'OAuth Login',
      subtitle: step === 'select-provider' ? 'Choose provider' : 'Browser login',
      content: contentElements,
      footer: step === 'select-provider' ? '↑/↓ select · Enter start · Esc cancel' : 'Esc cancel',
      width: termWidth,
    });
  }
}
