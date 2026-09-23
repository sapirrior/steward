import Component from '@steward/tui/engine/Component.js';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import {
  formatMarkdown,
  getStatusBullet,
  truncateMiddle,
  extractPrimaryToolParam,
} from '../utils/format.js';
import { wrapVisualLine } from '@steward/tui/engine/cell-layout.js';

export interface ActiveToolCall {
  id: string;
  name: string;
  displayName?: string;
  args?: Record<string, unknown>;
  startTime: number;
  recentLines?: string[];
}

export interface ActiveCommandState {
  command: string;
  recentLines?: string[];
}

export interface StreamingViewState {
  text: string;
  isStreaming: boolean;
  isThinking: boolean;
  thinkingStartTime?: number;
  activeTool?: ActiveToolCall | null;
  activeCommand?: ActiveCommandState | null;
  pulseFrame: number;
}

export default class StreamingView extends Component<{}, StreamingViewState> {
  override wrap = true;
  override clip = false;
  private pulseTimer: NodeJS.Timeout | null = null;

  constructor() {
    super({});
    this.state = {
      text: '',
      isStreaming: false,
      isThinking: false,
      activeTool: null,
      activeCommand: null,
      pulseFrame: 0,
    };
  }

  setThinking(isThinking: boolean): void {
    if (isThinking) {
      this.setState({
        isThinking: true,
        thinkingStartTime: this.state.isThinking ? this.state.thinkingStartTime : performance.now(),
      });
      this.ensurePulse();
    } else {
      this.setState({ isThinking: false, thinkingStartTime: undefined });
      this.ensurePulse();
    }
  }

  setStream(text: string, isStreaming: boolean): void {
    this.setState({
      text,
      isStreaming,
      isThinking: isStreaming && text.length > 0 ? false : this.state.isThinking,
    });
    this.ensurePulse();
  }

  setActiveTool(tool: ActiveToolCall | null): void {
    this.setState({
      activeTool: tool,
      isThinking: tool !== null ? false : this.state.isThinking,
    });
    this.ensurePulse();
  }

  updateToolOutput(recentLines: string[]): void {
    if (this.state.activeTool) {
      this.setState({
        activeTool: {
          ...this.state.activeTool,
          recentLines,
        },
      });
    }
  }

  setActiveCommand(command: string | null): void {
    this.setState({
      activeCommand: command ? { command, recentLines: [] } : null,
      isThinking: false,
    });
    this.ensurePulse();
  }

  updateCommandOutput(recentLines: string[]): void {
    if (this.state.activeCommand) {
      this.setState({
        activeCommand: {
          ...this.state.activeCommand,
          recentLines,
        },
      });
    }
  }

  private ensurePulse(): void {
    const isBusy =
      this.state.isStreaming ||
      this.state.activeTool ||
      this.state.activeCommand ||
      this.state.isThinking;
    if (isBusy && !this.pulseTimer) {
      this.pulseTimer = setInterval(() => {
        this.setState({ pulseFrame: this.state.pulseFrame + 1 });
      }, 120);
    } else if (!isBusy && this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  reset(): void {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.setState({
      text: '',
      isStreaming: false,
      isThinking: false,
      thinkingStartTime: undefined,
      activeTool: null,
      activeCommand: null,
      pulseFrame: 0,
    });
  }

  override componentWillUnmount(): void {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  override render(width?: number): string[] {
    const {
      text,
      isStreaming,
      isThinking,
      thinkingStartTime,
      activeTool,
      activeCommand,
      pulseFrame,
    } = this.state;
    if (!isStreaming && !text && !activeTool && !activeCommand && !isThinking) return [];

    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const textWidth = Math.max(1, maxCols - 2);

    const lines: string[] = [];

    // 0. Ongoing direct bash command (running live stream)
    if (activeCommand) {
      lines.push(`${c.permission('!')} ${c.text(activeCommand.command)}`);
      if (activeCommand.recentLines && activeCommand.recentLines.length > 0) {
        const toShow = activeCommand.recentLines.slice(-10);
        const maxLogLen = Math.max(10, maxCols - 6);
        for (let i = 0; i < toShow.length; i++) {
          const l = toShow[i] ?? '';
          const p = i === 0 ? `  ${c.muted('└ ')}` : '    ';
          const truncatedLog = l.length > maxLogLen ? `${l.slice(0, maxLogLen - 1)}…` : l;
          lines.push(`${p}${c.text(truncatedLog)}`);
        }
      } else {
        lines.push(`  ${c.muted('└ ')}${c.muted('Running...')}`);
      }
      return lines;
    }

    // 1. Ongoing active tool call (streaming live output)
    if (activeTool) {
      const bullet = getStatusBullet('running', pulseFrame % 2 === 0);
      const toolName =
        activeTool.displayName ??
        (activeTool.name
          ? activeTool.name.charAt(0).toUpperCase() + activeTool.name.slice(1)
          : 'Tool');

      const targetArg = extractPrimaryToolParam(activeTool.args);

      let line = `${bullet} ${bold(toolName)}`;
      if (targetArg) {
        const maxArgLen = Math.max(10, maxCols - toolName.length - 8);
        const truncatedArg =
          targetArg.length > maxArgLen ? truncateMiddle(targetArg, maxArgLen) : targetArg;
        line += `${c.muted('(')}${c.muted(truncatedArg)}${c.muted(')')}`;
      } else {
        line += `${c.muted('()')}`;
      }
      lines.push(line);

      if (activeTool.recentLines && activeTool.recentLines.length > 0) {
        const toShow = activeTool.recentLines.slice(-10);
        const maxLogLen = Math.max(10, maxCols - 6);
        for (let i = 0; i < toShow.length; i++) {
          const l = toShow[i] ?? '';
          const p = i === 0 ? `  ${c.muted('└ ')}` : '    ';
          const truncatedLog = l.length > maxLogLen ? `${l.slice(0, maxLogLen - 1)}…` : l;
          lines.push(`${p}${c.muted(truncatedLog)}`);
        }
      } else {
        lines.push(`  ${c.muted('└ Running...')}`);
      }
    } else if (isThinking && !text) {
      // 2. Animated Thinking indicator styled like a tool call
      const bullet = getStatusBullet('running', pulseFrame % 2 === 0);
      lines.push(`${bullet} ${bold(c.text('Thinking..'))}`);

      const elapsedMs = thinkingStartTime
        ? performance.now() - thinkingStartTime
        : pulseFrame * 120;

      // 20 progressive phrases matched to current style across 4 time horizons
      let subText = 'wait...';
      if (elapsedMs < 2500) {
        // Phase 1 (<2.5s)
        const p1 = ['wait...', 'hmm...', 'one sec...', 'looking into it...', 'checking...'];
        subText = p1[Math.floor(pulseFrame / 5) % p1.length]!;
      } else if (elapsedMs < 6000) {
        // Phase 2 (2.5s - 6s)
        const p2 = [
          'analyzing...',
          'thinking...',
          'working on it...',
          'connecting the dots...',
          'figuring this out...',
        ];
        subText = p2[Math.floor(pulseFrame / 6) % p2.length]!;
      } else if (elapsedMs < 11000) {
        // Phase 3 (6s - 11s)
        const p3 = [
          'still thinking...',
          'deep in thought...',
          'almost there...',
          'crunching details...',
          'piecing it together...',
        ];
        subText = p3[Math.floor(pulseFrame / 7) % p3.length]!;
      } else {
        // Phase 4 (>11s)
        const p4 = [
          'taking a bit of time...',
          'complex one, still on it...',
          'polishing up the answer...',
          'wrapping up thoughts...',
          'finishing up...',
        ];
        subText = p4[Math.floor(pulseFrame / 8) % p4.length]!;
      }

      lines.push(`  ${c.muted('└ ')}${c.muted(subText)}`);
    }

    // 3. Streaming assistant text
    if (text) {
      if (lines.length > 0) lines.push('');
      const formatted = formatMarkdown(text);
      if (formatted) {
        const rawLines = formatted.split('\n');
        const wrappedLines: string[] = [];
        for (const fl of rawLines) {
          if (!fl.trim()) {
            wrappedLines.push('');
          } else {
            const wrapped = wrapVisualLine(fl, textWidth);
            for (const wl of wrapped) {
              wrappedLines.push(wl);
            }
          }
        }

        for (let i = 0; i < wrappedLines.length; i++) {
          const l = wrappedLines[i] ?? '';
          if (!l.trim()) {
            lines.push('');
            continue;
          }
          if (i === 0) {
            const bullet = c.text(`${figures.blackCircle} `);
            lines.push(`${bullet}${l}`);
          } else {
            lines.push(`  ${l}`);
          }
        }
      }
    }

    return lines;
  }
}
