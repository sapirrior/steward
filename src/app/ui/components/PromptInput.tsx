import Component from '@steward/tui/engine/Component.js';
import { figures } from '@steward/tui/theme/index.js';
import { c, bold } from '@steward/tui/theme/style.js';
import { truncateToWidth } from '../utils/format.js';
import { parseKeyInput } from '@steward/tui/primitives/index.js';
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
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);

      // 1. Generation in progress: Escape aborts
      if (this.state.disabled) {
        if (action.type === 'escape') {
          this.props.onAbort?.();
          return true;
        }
        return false;
      }

      // 2. Escape: dismiss completions or double-tap to clear
      if (action.type === 'escape') {
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
      if (action.type === 'insert' && action.char === '?' && this.state.value.length === 0) {
        this.props.onToggleHelp?.();
        return true;
      }

      // 4. Multiline Newline insertion
      if (action.type === 'newline') {
        const before = this.state.value.slice(0, this.state.cursorPos);
        const after = this.state.value.slice(this.state.cursorPos);
        this.updateValueAndCheckCompletions(`${before}\n${after}`, this.state.cursorPos + 1);
        return true;
      }

      // 5. Submit
      if (action.type === 'submit') {
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

      // 6. Tab Completion
      if (action.type === 'tab') {
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

      // 7. Arrow Up
      if (action.type === 'cursor-up') {
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
        }
        return true;
      }

      // 8. Arrow Down
      if (action.type === 'cursor-down') {
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
        }
        return true;
      }

      // 9. Backspace & Deletion
      if (action.type === 'backspace') {
        if (this.state.cursorPos > 0) {
          const before = this.state.value.slice(0, this.state.cursorPos - 1);
          const after = this.state.value.slice(this.state.cursorPos);
          this.updateValueAndCheckCompletions(before + after, this.state.cursorPos - 1);
        }
        return true;
      }
      if (action.type === 'delete') {
        if (this.state.cursorPos < this.state.value.length) {
          const before = this.state.value.slice(0, this.state.cursorPos);
          const after = this.state.value.slice(this.state.cursorPos + 1);
          this.updateValueAndCheckCompletions(before + after, this.state.cursorPos);
        }
        return true;
      }
      if (action.type === 'delete-word') {
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
      if (action.type === 'clear-line') {
        this.updateValueAndCheckCompletions('', 0);
        return true;
      }

      // 10. Navigation Left/Right/Home/End
      if (action.type === 'cursor-left') {
        this.setState({ cursorPos: Math.max(0, this.state.cursorPos - 1) });
        return true;
      }
      if (action.type === 'cursor-right') {
        this.setState({ cursorPos: Math.min(this.state.value.length, this.state.cursorPos + 1) });
        return true;
      }
      if (action.type === 'cursor-home') {
        this.setState({ cursorPos: 0 });
        return true;
      }
      if (action.type === 'cursor-end') {
        this.setState({ cursorPos: this.state.value.length });
        return true;
      }

      // 11. Text insertion
      if (action.type === 'insert' && action.char) {
        const clean = action.char.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const before = this.state.value.slice(0, this.state.cursorPos);
        const after = this.state.value.slice(this.state.cursorPos);
        this.updateValueAndCheckCompletions(
          before + clean + after,
          this.state.cursorPos + clean.length,
        );
        return true;
      }

      return false;
    });
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

  override componentWillUnmount(): void {
    this.isMounted = false;
    this.syncSpinnerTimer();
    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = null;
    }
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
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

    // 1. Disabled (generating) state — Clean minimal layout with Esc to stop
    if (disabled) {
      lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));
      lines.push(truncateToWidth(`  ${c.muted('Esc to stop')}`, maxCols));
      lines.push(borderColor(figures.horizontalLine.repeat(dividerWidth)));
      return { lines, cursor: null };
    }

    // Top Border (embeds History text in white on the border without extra lines)
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
      for (let i = 0; i < matchingCommands.length; i++) {
        const cmd = matchingCommands[i]!;
        const isSelected = i === paletteIdx;
        const namePadded = `/${cmd.name}`.padEnd(18);
        if (isSelected) {
          lines.push(
            truncateToWidth(`${bold(c.text(namePadded))}${bold(c.text(cmd.description))}`, maxCols),
          );
        } else {
          lines.push(truncateToWidth(`${c.muted(namePadded)}${c.muted(cmd.description)}`, maxCols));
        }
      }
    }

    // Inline FileMatches
    const fileMatches = this.state.fileMatches ?? this.autocomplete.getMatches();
    const fileSelectIdx = this.state.fileSelectIdx ?? this.autocomplete.getSelectedIndex();
    if (fileMatches.length > 0) {
      lines.push(c.muted('Matching files (@):'));
      for (let i = 0; i < fileMatches.length; i++) {
        const f = fileMatches[i]!;
        const isSelected = i === fileSelectIdx;
        const p = isSelected ? c.info(`${figures.pointer} `) : '  ';
        const fileText = isSelected ? c.info(f) : c.muted(f);
        lines.push(truncateToWidth(`${p}${fileText}`, maxCols));
      }
    }

    return { lines, cursor };
  }
}
