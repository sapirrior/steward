/** @jsxImportSource stitchable */
import { Component, Box, Text, Spacer, renderElement } from 'stitchable';
import { type ChatMode, MODES, getActiveMode } from '@steward/agent';
import { figures } from '../../theme/index.js';
import { c, bold } from '../../theme/style.js';

export interface StatusBarProps {
  chatMode?: ChatMode;
  model: {
    provider: string;
    modelId: string;
    effort?: string;
  };
  isBusy: boolean;
  exitPending?: boolean;
  isBashMode?: boolean;
  warning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StatusBarState {
  chatMode?: ChatMode;
  model: {
    provider: string;
    modelId: string;
    effort?: string;
  };
  isBusy: boolean;
  exitPending?: boolean;
  isBashMode?: boolean;
  warning?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function renderStatusBar(state: StatusBarState, width: number = 80): string[] {
  const maxCols = Math.max(1, width);
  const { model, isBusy, exitPending, isBashMode, warning, chatMode } = state;

  let left = '';
  if (warning) {
    left = c.warning(warning);
  } else if (exitPending) {
    left = `${c.error('▸ ')}${c.muted('Press ')}${c.error('Ctrl+C')}${c.muted(' again to exit')}`;
  } else if (isBusy) {
    left = c.muted('esc to interrupt');
  } else if (isBashMode) {
    left = c.permission('! for bash mode');
  } else {
    left = c.muted('? for shortcuts');
  }

  const mode = chatMode ?? 'normal';
  const modeMeta = MODES[mode];
  const modeColorKey = modeMeta?.color ?? 'text';
  const modeLabel = modeMeta?.label ?? mode;

  const parts: string[] = [];
  parts.push(c[modeColorKey](modeLabel));

  const effort = model?.effort ?? 'provider-default';
  const effortDisplay = effort === 'provider-default' ? 'default' : effort;
  parts.push(c.muted(effortDisplay));

  const right = parts.length > 0 ? parts.join(c.muted(` ${figures.bullet} `)) : '';

  const element = (
    <Box flexDirection="row" justifyContent="space-between" width={maxCols}>
      <Text wrap="truncate">{left}</Text>
      <Spacer />
      <Text wrap="truncate">{right}</Text>
    </Box>
  );

  return renderElement(element, { width: maxCols });
}

export default class StatusBar extends Component<StatusBarProps, StatusBarState> {
  override wrap = false;
  override clip = true;

  private warningTimer: NodeJS.Timeout | null = null;

  constructor(props: StatusBarProps) {
    super(props);
    this.state = {
      chatMode: props.chatMode ?? getActiveMode(),
      model: props.model,
      isBusy: props.isBusy,
      exitPending: props.exitPending,
      isBashMode: props.isBashMode,
      warning: props.warning,
      usage: props.usage,
    };
  }

  setBashMode(isBashMode: boolean): void {
    if (this.state.isBashMode !== isBashMode) {
      this.setState({ isBashMode });
    }
  }

  setMode(mode: ChatMode): void {
    this.setState({ chatMode: mode });
  }

  update(partial: Partial<StatusBarState>): void {
    this.setState(partial);
  }

  showWarning(warningText: string, durationMs = 4000): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    this.setState({ warning: warningText });

    this.warningTimer = setTimeout(() => {
      this.warningTimer = null;
      if (this.state.warning === warningText) {
        this.setState({ warning: undefined });
      }
    }, durationMs);
  }

  override componentWillUnmount(): void {
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  override render(width?: number): string[] {
    return renderStatusBar(this.state, width ?? process.stdout.columns ?? 80);
  }
}
