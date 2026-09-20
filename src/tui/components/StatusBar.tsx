import Component from '../engine/Component.js';
import { type ChatMode, MODES, getActiveMode } from '../../engine/mode.js';
import { figures } from '../../theme/index.js';
import { c, bold } from '../../theme/style.js';
import { Box, Text } from '../primitives/index.js';

export type StatusBarVoiceState = 'idle' | 'connecting' | 'recording' | 'finishing';

export interface StatusBarUpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'no-updates' | 'error';
  version?: string;
  message?: string;
}

export interface StatusBarProps {
  chatMode?: ChatMode;
  model: {
    provider: string;
    modelId: string;
    effort?: string;
  };
  isBusy: boolean;
  exitPending?: boolean;
  warning?: string;
  voiceState?: StatusBarVoiceState;
  voiceDurationSec?: number;
  updateStatus?: StatusBarUpdateStatus;
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
  warning?: string;
  voiceState?: StatusBarVoiceState;
  voiceDurationSec?: number;
  updateStatus?: StatusBarUpdateStatus;
}

function formatVoiceDuration(sec: number): string {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default class StatusBar extends Component<StatusBarProps, StatusBarState> {
  override wrap = false;
  override clip = true;

  private warningTimer: NodeJS.Timeout | null = null;
  private voiceTimer: NodeJS.Timeout | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor(props: StatusBarProps) {
    super(props);
    this.state = {
      chatMode: props.chatMode ?? getActiveMode(),
      model: props.model,
      isBusy: props.isBusy,
      exitPending: props.exitPending,
      warning: props.warning,
      voiceState: props.voiceState ?? 'idle',
      voiceDurationSec: props.voiceDurationSec ?? 0,
      updateStatus: props.updateStatus,
    };
  }

  setMode(mode: ChatMode): void {
    this.setState({ chatMode: mode });
  }

  update(partial: Partial<StatusBarState>): void {
    this.setState(partial);
  }

  /**
   * Updates the voice recording status shown on the status bar in white text.
   */
  setVoiceState(voiceState: StatusBarVoiceState): void {
    if (this.voiceTimer) {
      clearInterval(this.voiceTimer);
      this.voiceTimer = null;
    }

    if (voiceState === 'recording') {
      this.setState({ voiceState, voiceDurationSec: 0 });
      this.voiceTimer = setInterval(() => {
        this.setState({ voiceDurationSec: (this.state.voiceDurationSec ?? 0) + 1 });
      }, 1000);
    } else {
      this.setState({
        voiceState,
        voiceDurationSec: voiceState === 'idle' ? 0 : this.state.voiceDurationSec,
      });
    }
  }

  /**
   * Updates the background updater status shown on the status bar, optionally clearing after durationMs.
   */
  setUpdateStatus(updateStatus?: StatusBarUpdateStatus, durationMs?: number): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    this.setState({ updateStatus });

    if (updateStatus && durationMs && durationMs > 0) {
      this.updateTimer = setTimeout(() => {
        this.updateTimer = null;
        if (this.state.updateStatus === updateStatus) {
          this.setState({ updateStatus: undefined });
        }
      }, durationMs);
    }
  }

  /**
   * Displays a transient warning message in yellow that clears automatically after durationMs.
   */
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
    if (this.voiceTimer) {
      clearInterval(this.voiceTimer);
      this.voiceTimer = null;
    }
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }

  override render(width?: number): string[] {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const {
      model,
      isBusy,
      exitPending,
      warning,
      voiceState,
      voiceDurationSec,
      updateStatus,
      chatMode,
    } = this.state;

    let left = '';
    if (warning) {
      left = c.warning(warning);
    } else if (voiceState && voiceState !== 'idle') {
      if (voiceState === 'connecting') {
        left = `${bold(c.text('Connecting...'))}   ${c.muted('Ctrl+T to stop')}`;
      } else if (voiceState === 'recording') {
        const timeStr = formatVoiceDuration(voiceDurationSec ?? 0);
        left = `${bold(c.text(`Recording... ${timeStr}`))}   ${c.muted('Ctrl+T to stop')}`;
      } else if (voiceState === 'finishing') {
        left = bold(c.text('Finishing...'));
      }
    } else if (exitPending) {
      left = `${c.error('▸ ')}${c.muted('Press ')}${c.error('Ctrl+C')}${c.muted(' again to exit')}`;
    } else if (updateStatus && updateStatus.state !== 'idle') {
      if (updateStatus.state === 'checking') {
        left = c.text(updateStatus.message ?? 'Checking for updates...');
      } else if (updateStatus.state === 'available') {
        left = c.text(updateStatus.message ?? `Update v${updateStatus.version ?? ''} is available`);
      } else if (updateStatus.state === 'no-updates') {
        left = c.text(updateStatus.message ?? 'Steward is up to date');
      } else if (updateStatus.state === 'error' && updateStatus.message) {
        left = c.error(updateStatus.message);
      } else if (isBusy) {
        left = c.muted('esc to interrupt');
      } else {
        left = c.muted('? for shortcuts');
      }
    } else if (isBusy) {
      left = c.muted('esc to interrupt');
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
      <Box direction="row" justify="space-between" width={maxCols} clip={true}>
        <Text clip={true}>{left}</Text>
        <Text clip={true}>{right}</Text>
      </Box>
    );

    return element.render(maxCols);
  }
}
