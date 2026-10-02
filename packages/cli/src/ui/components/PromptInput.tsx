import { Component, parseInputChunk } from 'stitchable';
import { figures } from '../../theme/index.js';
import { c, bold } from '../../theme/style.js';
import { truncateToWidth } from '../utils/format.js';
import { AutocompleteController } from './prompt-input/autocomplete-controller.js';
import { CommandPaletteController } from './prompt-input/command-palette-controller.js';
import { HistoryController } from './prompt-input/history-controller.js';

export interface PromptInputProps {
  onSubmit: (text: string) => void;
  onAbort?: () => void;
  onToggleHelp?: () => void;
  onBashModeChange?: (isBashMode: boolean) => void;
  cwd?: string;
  initialHistory?: string[];
}

export interface PromptInputState {
  value: string;
  cursorPos: number;
  disabled: boolean;
  escPending: boolean;
  spinnerFrame: number;
  fileMatches?: string[];
  fileSelectIdx?: number;
  paletteIdx?: number;
  historyIndex?: number;
}

export default class PromptInput extends Component<PromptInputProps, PromptInputState> {
  override wrap = true;
  override clip = true;
  override ellipsis = false;

  private autocomplete: AutocompleteController;
  private commandPalette: CommandPaletteController;
  private historyController: HistoryController;

  private removeInputListener: (() => void) | null = null;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private escTimer: NodeJS.Timeout | null = null;
  private isMounted = false;

  constructor(props: PromptInputProps) {
    super(props);
    this.autocomplete = new AutocompleteController(props.cwd);
    this.commandPalette = new CommandPaletteController();
    this.historyController = new HistoryController(props.initialHistory);

    this.state = {
      value: '',
      cursorPos: 0,
      disabled: false,
      escPending: false,
      spinnerFrame: 0,
    };
    this.attachInput();
  }

  private attachInput(): void {
    if (this.removeInputListener) return;

    const handleChunk = (chunk: string | Buffer): boolean | void => {
      const rawStr = Buffer.isBuffer(chunk)
        ? chunk.toString('utf-8')
        : typeof chunk === 'string'
          ? chunk
          : String(chunk);

      // Strip SGR mouse sequences (\x1b[<...M/m) and X10 mouse sequences (\x1b[M...)
      const noMouseStr = rawStr
        .replace(/\x1b\[<[0-9;]+[Mm]/g, '')
        .replace(/\x1b\[M[\x20-\xff]{3}/g, '');
      if (!noMouseStr) return false;

      const normalized = noMouseStr.replace(/\x1bO([A-D])/g, '\x1b[$1');
      const events = parseInputChunk(normalized);

      for (const ev of events) {
        const k = ev.key;

        // 1. Generation in progress: Escape aborts
        if (this.state.disabled) {
          if (k.escape) {
            this.props.onAbort?.();
            return true;
          }
          return false;
        }

        // 2. Escape: dismiss completions or double-tap to clear
        if (k.escape) {
          if (this.autocomplete.onEscape()) {
            this.setState({ fileMatches: [] });
            return true;
          }
          if (this.commandPalette.dismiss()) {
            this.markDirty();
            return true;
          }
          if (this.state.value.length > 0) {
            if (this.state.escPending) {
              if (this.escTimer) clearTimeout(this.escTimer);
              this.escTimer = null;
              this.historyController.resetIndex();
              this.setState({ value: '', cursorPos: 0, escPending: false, historyIndex: -1 });
            } else {
              this.setState({ escPending: true });
              if (this.escTimer) clearTimeout(this.escTimer);
              this.escTimer = setTimeout(() => {
                this.setState({ escPending: false });
              }, 600);
            }
            return true;
          }
          return false;
        }

        // 3. Question mark when empty opens Help
        if (ev.input === '?' && this.state.value.length === 0) {
          this.props.onToggleHelp?.();
          return true;
        }

        // 4. Ctrl+W delete word
        if (k.ctrl && k.name === 'w') {
          const before = this.state.value.slice(0, this.state.cursorPos);
          const match = before.match(/(\s*\S+)\s*$/);
          const deleteCount = match ? match[0].length : 1;
          const newPos = Math.max(0, this.state.cursorPos - deleteCount);
          this.updateValueAndCheckCompletions(
            this.state.value.slice(0, newPos) + this.state.value.slice(this.state.cursorPos),
            newPos,
          );
          return true;
        }

        // 5. Ctrl+U clear line
        if (k.ctrl && k.name === 'u') {
          this.updateValueAndCheckCompletions('', 0);
          return true;
        }

        // 6. Submit or Shift+Enter newline
        if (k.return) {
          if (k.shift) {
            const before = this.state.value.slice(0, this.state.cursorPos);
            const after = this.state.value.slice(this.state.cursorPos);
            this.updateValueAndCheckCompletions(`${before}\n${after}`, this.state.cursorPos + 1);
            return true;
          }

          const autoResult = this.autocomplete.onSubmit(this.state.value, this.state.cursorPos);
          if (autoResult.handled && autoResult.nextValue !== undefined) {
            this.setState({
              value: autoResult.nextValue,
              cursorPos: autoResult.nextPos ?? autoResult.nextValue.length,
              fileMatches: [],
            });
            return true;
          }

          const cmdResult = this.commandPalette.onSubmit(this.state.value);
          if (cmdResult.handled && cmdResult.chosenCommand) {
            this.historyController.add(cmdResult.chosenCommand);
            this.setState({ value: '', cursorPos: 0, fileMatches: [] });
            this.autocomplete.clear();
            this.props.onSubmit(cmdResult.chosenCommand);
            return true;
          }

          if (this.state.cursorPos > 0 && this.state.value[this.state.cursorPos - 1] === '\\') {
            const before = this.state.value.slice(0, this.state.cursorPos - 1);
            const after = this.state.value.slice(this.state.cursorPos);
            this.updateValueAndCheckCompletions(`${before}\n${after}`, this.state.cursorPos);
            return true;
          }

          const trimmed = this.state.value.trim();
          if (trimmed) {
            if (trimmed.startsWith('!')) {
              this.props.onBashModeChange?.(false);
            }
            this.historyController.add(trimmed);
            this.setState({ value: '', cursorPos: 0, fileMatches: [] });
            this.autocomplete.clear();
            this.props.onSubmit(trimmed);
          }
          return true;
        }

        // 7. Tab Completion
        if (k.tab) {
          const autoResult = this.autocomplete.onTab(this.state.value, this.state.cursorPos);
          if (autoResult.handled && autoResult.nextValue !== undefined) {
            this.setState({
              value: autoResult.nextValue,
              cursorPos: autoResult.nextPos ?? autoResult.nextValue.length,
              fileMatches: [],
            });
            return true;
          }

          const cmdResult = this.commandPalette.onTab(this.state.value);
          if (cmdResult.handled && cmdResult.completedText) {
            this.setState({
              value: cmdResult.completedText,
              cursorPos: cmdResult.completedText.length,
            });
            return true;
          }
          return true;
        }

        // 8. Arrow Up / Page Up
        if (k.pageUp) {
          this.engine?.scrollUp(5);
          return true;
        }
        if (k.pageDown) {
          this.engine?.scrollDown(5);
          return true;
        }

        if (k.upArrow) {
          if (k.shift) {
            this.engine?.scrollUp(1);
            return true;
          }
          if (this.autocomplete.onUp()) {
            this.setState({ fileSelectIdx: this.autocomplete.getSelectedIndex() });
            return true;
          }
          if (this.commandPalette.onUp(this.state.value)) {
            this.setState({ paletteIdx: this.commandPalette.getSelectedIndex() });
            return true;
          }

          const beforeCursor = this.state.value.slice(0, this.state.cursorPos);
          const lastNewline = beforeCursor.lastIndexOf('\n');
          if (lastNewline !== -1) {
            const colOnCurLine = this.state.cursorPos - (lastNewline + 1);
            const prevNewline = beforeCursor.slice(0, lastNewline).lastIndexOf('\n');
            const prevLineStart = prevNewline === -1 ? 0 : prevNewline + 1;
            const prevLineLen = lastNewline - prevLineStart;
            this.setState({ cursorPos: prevLineStart + Math.min(colOnCurLine, prevLineLen) });
            return true;
          }

          const histResult = this.historyController.onUp(this.state.value);
          if (histResult.handled && histResult.nextValue !== undefined) {
            this.setState({
              value: histResult.nextValue,
              cursorPos: histResult.nextPos ?? histResult.nextValue.length,
              historyIndex: this.historyController.getIndex(),
            });
            return true;
          }

          if (!this.state.value) {
            this.engine?.scrollUp(1);
          }
          return true;
        }

        // 9. Arrow Down
        if (k.downArrow) {
          if (k.shift) {
            this.engine?.scrollDown(1);
            return true;
          }
          if (this.autocomplete.onDown()) {
            this.setState({ fileSelectIdx: this.autocomplete.getSelectedIndex() });
            return true;
          }
          if (this.commandPalette.onDown(this.state.value)) {
            this.setState({ paletteIdx: this.commandPalette.getSelectedIndex() });
            return true;
          }

          const nextNewline = this.state.value.indexOf('\n', this.state.cursorPos);
          if (nextNewline !== -1) {
            const beforeCursor = this.state.value.slice(0, this.state.cursorPos);
            const lastNewline = beforeCursor.lastIndexOf('\n');
            const colOnCurLine =
              lastNewline === -1 ? this.state.cursorPos : this.state.cursorPos - (lastNewline + 1);
            const nextLineStart = nextNewline + 1;
            const nextNextNewline = this.state.value.indexOf('\n', nextLineStart);
            const nextLineEnd = nextNextNewline === -1 ? this.state.value.length : nextNextNewline;
            this.setState({
              cursorPos: nextLineStart + Math.min(colOnCurLine, nextLineEnd - nextLineStart),
            });
            return true;
          }

          const histResult = this.historyController.onDown();
          if (histResult.handled && histResult.nextValue !== undefined) {
            this.setState({
              value: histResult.nextValue,
              cursorPos: histResult.nextPos ?? histResult.nextValue.length,
              historyIndex: this.historyController.getIndex(),
            });
            return true;
          }

          if (!this.state.value) {
            this.engine?.scrollDown(1);
          }
          return true;
        }

        // 10. Backspace & Deletion
        if (k.backspace) {
          if (this.state.cursorPos > 0) {
            const before = this.state.value.slice(0, this.state.cursorPos - 1);
            const after = this.state.value.slice(this.state.cursorPos);
            this.updateValueAndCheckCompletions(before + after, this.state.cursorPos - 1);
          }
          return true;
        }
        if (k.delete) {
          if (this.state.cursorPos < this.state.value.length) {
            const before = this.state.value.slice(0, this.state.cursorPos);
            const after = this.state.value.slice(this.state.cursorPos + 1);
            this.updateValueAndCheckCompletions(before + after, this.state.cursorPos);
          }
          return true;
        }

        // 11. Navigation Left/Right/Home/End
        if (k.leftArrow) {
          this.setState({ cursorPos: Math.max(0, this.state.cursorPos - 1) });
          return true;
        }
        if (k.rightArrow) {
          this.setState({ cursorPos: Math.min(this.state.value.length, this.state.cursorPos + 1) });
          return true;
        }
        if (k.home || (k.ctrl && k.name === 'a')) {
          this.setState({ cursorPos: 0 });
          return true;
        }
        if (k.end || (k.ctrl && k.name === 'e')) {
          this.setState({ cursorPos: this.state.value.length });
          return true;
        }

        // 12. Text insertion / paste
        if (
          !k.upArrow &&
          !k.downArrow &&
          !k.leftArrow &&
          !k.rightArrow &&
          !k.return &&
          !k.escape &&
          !k.tab &&
          !k.backspace &&
          !k.delete &&
          !k.pageUp &&
          !k.pageDown &&
          !k.home &&
          !k.end &&
          !k.ctrl &&
          !k.meta
        ) {
          if (!ev.input) continue;
          if (ev.input.includes('\x1b')) continue;

          let clean = ev.input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
          if (!ev.isPaste) {
            clean = clean.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
          }
          if (clean.length > 0) {
            const before = this.state.value.slice(0, this.state.cursorPos);
            const after = this.state.value.slice(this.state.cursorPos);
            this.updateValueAndCheckCompletions(
              before + clean + after,
              this.state.cursorPos + clean.length,
            );
            return true;
          }
        }
      }

      return false;
    };

    if (this.engine) {
      this.removeInputListener = this.engine.addInputListener(handleChunk);
    } else if (typeof process !== 'undefined' && process.stdin && !process.stdin.isTTY) {
      const stdinListener = (data: Buffer) => handleChunk(data);
      process.stdin.on('data', stdinListener);
      this.removeInputListener = () => {
        process.stdin.off('data', stdinListener);
      };
    }
  }

  private syncSpinnerTimer(): void {
    if (this.isMounted && this.state.disabled) {
      if (!this.spinnerTimer) {
        this.spinnerTimer = setInterval(() => {
          this.setState({ spinnerFrame: this.state.spinnerFrame + 1 });
        }, 80);
      }
    } else {
      if (this.spinnerTimer) {
        clearInterval(this.spinnerTimer);
        this.spinnerTimer = null;
      }
    }
  }

  setDisabled(disabled: boolean): void {
    if (this.state.disabled === disabled) return;
    this.setState({ disabled });
    this.syncSpinnerTimer();
  }

  addHistory(item: string): void {
    this.historyController.add(item);
  }

  override componentDidMount(): void {
    this.isMounted = true;
    this.syncSpinnerTimer();
    this.attachInput();
  }

  override componentWillUnmount(): void {
    this.isMounted = false;
    this.syncSpinnerTimer();
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = null;
    }
  }

  private updateValueAndCheckCompletions(nextVal: string, nextPos: number): void {
    const clampedPos = Math.max(0, Math.min(nextVal.length, nextPos));
    const prevIsBash = this.state.value.startsWith('!');
    const nextIsBash = nextVal.startsWith('!');
    if (prevIsBash !== nextIsBash) {
      this.props.onBashModeChange?.(nextIsBash);
    }
    this.commandPalette.resetDismissed();
    this.setState({ value: nextVal, cursorPos: clampedPos });
    this.autocomplete.updateQuery(nextVal, clampedPos, () => {
      this.setState({
        fileMatches: this.autocomplete.getMatches(),
        fileSelectIdx: this.autocomplete.getSelectedIndex(),
      });
    });
  }

  override render(width?: number): string[] {
    return this.renderWithCursor(width).lines;
  }

  override renderWithCursor(width?: number): {
    lines: string[];
    cursor: { logicalLineIndex: number; characterOffsetWithinLine: number } | null;
  } {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const dividerWidth = maxCols;
    const { value, cursorPos, disabled, escPending } = this.state;

    const history = this.historyController.getHistory();
    const historyIndex = this.state.historyIndex ?? this.historyController.getIndex();

    const lines: string[] = [];
    let cursor: { logicalLineIndex: number; characterOffsetWithinLine: number } | null = null;

    if (escPending) {
      lines.push(c.permission('Press Esc again to clear'));
    }

    const isBashMode = value.startsWith('!');
    const borderColor = isBashMode ? c.permission : disabled ? c.subtle : c.promptBorder;

    // 1. Disabled (generating) state
    if (disabled) {
      lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));
      lines.push(truncateToWidth(`  ${c.muted('Esc to stop')}`, maxCols));
      lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));
      return { lines, cursor: null };
    }

    // Top Border
    if (historyIndex !== -1 && history.length > 0) {
      const histText = ` History ${historyIndex + 1}/${history.length} `;
      const leftDashes = borderColor(figures.horizontalLine.repeat(4));
      const rightLen = Math.max(0, maxCols - (4 + histText.length));
      const rightDashes = borderColor(figures.horizontalLine.repeat(rightLen));
      lines.push(`${leftDashes}${c.text(histText)}${rightDashes}`);
    } else {
      lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));
    }

    const effectiveValue = value;
    const effectiveCursorPos = cursorPos;

    if (effectiveValue.length === 0) {
      cursor = {
        logicalLineIndex: lines.length,
        characterOffsetWithinLine: 0,
      };
      lines.push(truncateToWidth(c.muted('Type your message...'), maxCols));
    } else {
      const vLines = effectiveValue.split('\n');
      let currentOffset = 0;

      for (let i = 0; i < vLines.length; i++) {
        const l = vLines[i] ?? '';
        const lineLen = l.length;
        const isLast = i === vLines.length - 1;
        const lineEndOffset = currentOffset + lineLen;

        if (
          cursor === null &&
          effectiveCursorPos >= currentOffset &&
          (effectiveCursorPos <= lineEndOffset || isLast)
        ) {
          cursor = {
            logicalLineIndex: lines.length,
            characterOffsetWithinLine: effectiveCursorPos - currentOffset,
          };
        }

        lines.push(c.text(l));
        currentOffset = lineEndOffset + 1;
      }
    }

    // Bottom Border
    lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));

    // Inline CommandPalette
    const matchingCommands = this.commandPalette.getMatchingCommands(effectiveValue);
    const paletteIdx = this.state.paletteIdx ?? this.commandPalette.getSelectedIndex();

    if (
      this.commandPalette.isSlashMode(effectiveValue) &&
      matchingCommands.length > 0 &&
      effectiveValue !== `/${matchingCommands[0]?.name} `
    ) {
      const maxVisible = 5;
      const startIdx = Math.max(
        0,
        Math.min(paletteIdx - Math.floor(maxVisible / 2), matchingCommands.length - maxVisible),
      );
      const visibleCmds = matchingCommands.slice(
        Math.max(0, startIdx),
        Math.max(0, startIdx) + maxVisible,
      );

      for (let relIdx = 0; relIdx < visibleCmds.length; relIdx++) {
        const cmd = visibleCmds[relIdx]!;
        const actualIdx = Math.max(0, startIdx) + relIdx;
        const isSelected = actualIdx === paletteIdx;
        const p = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const namePadded = `/${cmd.name}`.padEnd(16);
        const nameText = isSelected ? c.info(namePadded) : c.text(namePadded);
        const descText = isSelected ? c.info(cmd.description) : c.muted(cmd.description);
        lines.push(truncateToWidth(`${p}${nameText}${descText}`, maxCols));
      }
    }

    // Inline FileMatches
    const fileMatches = this.state.fileMatches ?? this.autocomplete.getMatches();
    const fileSelectIdx = this.state.fileSelectIdx ?? this.autocomplete.getSelectedIndex();
    if (fileMatches.length > 0) {
      lines.push(c.muted('Matching files (@):'));
      const maxVisible = 5;
      const startIdx = Math.max(
        0,
        Math.min(fileSelectIdx - Math.floor(maxVisible / 2), fileMatches.length - maxVisible),
      );
      const visibleFiles = fileMatches.slice(
        Math.max(0, startIdx),
        Math.max(0, startIdx) + maxVisible,
      );

      for (let relIdx = 0; relIdx < visibleFiles.length; relIdx++) {
        const f = visibleFiles[relIdx]!;
        const actualIdx = Math.max(0, startIdx) + relIdx;
        const isSelected = actualIdx === fileSelectIdx;
        const p = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const fileText = isSelected ? c.info(f) : c.muted(f);
        lines.push(truncateToWidth(`${p}${fileText}`, maxCols));
      }
    }

    return { lines, cursor };
  }
}
