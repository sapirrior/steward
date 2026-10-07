/** @jsxImportSource stitchable */
import { Component, Box, Text, renderElement, wrapVisualLine, type InputEvent } from 'stitchable';
import { figures } from '../../../theme/figures.js';
import { c, bg, bold, italic } from '../../../theme/style.js';
import { type FilePermissionRequest } from '../../../tools/types.js';
import { buildUnifiedDiff, type UnifiedDiff } from '../../../utils/diff/diff.js';
import { highlightCode } from '../../format/highlight.js';
import { handleChoiceKey } from '../../utils/choice.js';

export interface FilePermissionDockProps {
  request: FilePermissionRequest;
  onDecision: (allowed: boolean) => void;
}

export type FilePermissionDockMode = 'NORMAL' | 'REVIEW';

export interface FilePermissionDockState {
  mode: FilePermissionDockMode;
  selectedIndex: number; // 0 = Yes, 1 = No
  scrollOffset: number;
}

export function prefixedBlock(
  firstPrefix: string,
  content: string,
  options: {
    continuationPrefix?: string;
    width?: number;
    bg?: (s: string) => string;
  } = {},
): string[] {
  const width = options.width ?? 80;
  const contPrefix = options.continuationPrefix ?? ' '.repeat(firstPrefix.length);
  const rawLines = content.split(/\r?\n/);
  const rows: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const p = i === 0 ? firstPrefix : contPrefix;
    const lineContent = rawLines[i] ?? '';
    const fullLine = `${p}${lineContent}`;
    const wrapped = wrapVisualLine(fullLine, width);
    for (const wl of wrapped) {
      rows.push(options.bg ? options.bg(wl) : wl);
    }
  }

  return rows;
}

export default class FilePermissionDock extends Component<
  FilePermissionDockProps,
  FilePermissionDockState
> {
  override wrap = true;
  override clip = false;

  private removeInputListener: (() => void) | null = null;
  private lastRenderWidth = 80;

  constructor(props: FilePermissionDockProps) {
    super(props);
    this.state = {
      mode: 'NORMAL',
      selectedIndex: 0, // Default to Option 1: Yes
      scrollOffset: 0,
    };
  }

  override componentDidMount(): void {
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((ev: InputEvent) => {
      if (this.state.mode === 'NORMAL') {
        if (!ev.isPaste && (ev.input === 'f' || ev.input === 'F')) {
          this.setState({ mode: 'REVIEW', scrollOffset: 0 });
          return true;
        }

        const action = handleChoiceKey(ev, this.state.selectedIndex, 2);
        if (!action) return false;

        if (action.type === 'move') {
          this.setState({ selectedIndex: action.index });
          return true;
        }

        if (action.type === 'confirm') {
          this.props.onDecision(action.index === 0);
          return true;
        }

        if (action.type === 'cancel') {
          this.props.onDecision(false);
          return true;
        }
      } else if (this.state.mode === 'REVIEW') {
        if (!ev.isPaste && (ev.input === 'f' || ev.input === 'F' || ev.key.escape)) {
          this.setState({ mode: 'NORMAL', scrollOffset: 0 });
          return true;
        }
        if (ev.key.upArrow) {
          this.setState({ scrollOffset: Math.max(0, this.state.scrollOffset - 1) });
          return true;
        }
        if (ev.key.downArrow) {
          this.setState({
            scrollOffset: Math.min(this.getMaxScroll(), this.state.scrollOffset + 1),
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
  }

  private getMaxScroll(): number {
    const termWidth = this.lastRenderWidth;
    const allContentRows = this.renderContentRows(termWidth);
    const maxVisibleReviewLines = 15;
    return Math.max(0, allContentRows.length - maxVisibleReviewLines);
  }

  private renderContentRows(maxCols: number): string[] {
    const { request } = this.props;
    const { kind, before, after } = request;

    if (kind === 'create' || kind === 'overwrite') {
      const rawLines = after.split(/\r?\n/);
      const lines = after === '' ? [] : rawLines;
      const maxLineNum = Math.max(1, lines.length);
      const gutterWidth = Math.max(2, String(maxLineNum).length);

      const renderedRows: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const lineNumStr = String(lineNum).padStart(gutterWidth, ' ');
        const firstPrefix = ` ${c.muted(lineNumStr)}  `;
        const contPrefix = ` ${' '.repeat(gutterWidth)}  `;
        const wrapped = prefixedBlock(firstPrefix, lines[i] ?? '', {
          continuationPrefix: contPrefix,
          width: maxCols,
        });
        renderedRows.push(...wrapped);
      }
      return renderedRows;
    }

    // Edit mode: Unified diff
    const diff: UnifiedDiff = buildUnifiedDiff(before ?? '', after, 3);
    const renderedRows: string[] = [];

    let maxLineNum = 1;
    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.oldLineNumber) maxLineNum = Math.max(maxLineNum, line.oldLineNumber);
        if (line.newLineNumber) maxLineNum = Math.max(maxLineNum, line.newLineNumber);
      }
    }
    const gutterWidth = Math.max(2, String(maxLineNum).length);

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.kind === 'deletion') {
          const numStr = String(line.oldLineNumber ?? '').padStart(gutterWidth, ' ');
          const firstPrefix = ` ${c.muted(numStr)} `;
          const contPrefix = ` ${' '.repeat(gutterWidth)} `;
          const bodyText = line.spans
            ? c.diffDelFg('-') +
              line.spans
                .map((s) =>
                  s.kind === 'deletion' ? bold(c.diffDelFg(s.text)) : c.diffDelFg(s.text),
                )
                .join('')
            : c.diffDelFg(`-${line.text}`);
          const wrapped = prefixedBlock(firstPrefix, bodyText, {
            continuationPrefix: contPrefix,
            width: maxCols,
            bg: bg.diffDelBg,
          });
          renderedRows.push(...wrapped);
        } else if (line.kind === 'addition') {
          const numStr = String(line.newLineNumber ?? '').padStart(gutterWidth, ' ');
          const firstPrefix = ` ${c.muted(numStr)} `;
          const contPrefix = ` ${' '.repeat(gutterWidth)} `;
          const bodyText = line.spans
            ? c.diffAddFg('+') +
              line.spans
                .map((s) =>
                  s.kind === 'addition' ? bold(c.diffAddFg(s.text)) : c.diffAddFg(s.text),
                )
                .join('')
            : c.diffAddFg(`+${line.text}`);
          const wrapped = prefixedBlock(firstPrefix, bodyText, {
            continuationPrefix: contPrefix,
            width: maxCols,
            bg: bg.diffAddBg,
          });
          renderedRows.push(...wrapped);
        } else {
          const lineNum = line.newLineNumber ?? line.oldLineNumber ?? '';
          const numStr = String(lineNum).padStart(gutterWidth, ' ');
          const firstPrefix = ` ${c.muted(numStr)}  `;
          const contPrefix = ` ${' '.repeat(gutterWidth)}  `;
          const wrapped = prefixedBlock(firstPrefix, line.text, {
            continuationPrefix: contPrefix,
            width: maxCols,
          });
          renderedRows.push(...wrapped);
        }
      }
    }

    return renderedRows;
  }

  override render(width?: number): string[] {
    const termWidth = width ?? 80;
    this.lastRenderWidth = termWidth;
    const maxCols = Math.max(1, termWidth);

    const { mode, selectedIndex, scrollOffset } = this.state;
    const { request } = this.props;
    const { kind, filePath } = request;

    const pointer = figures.pointer ?? '>';
    const isYesSelected = selectedIndex === 0;
    const isNoSelected = selectedIndex === 1;

    const divider = c.rule(figures.horizontalLine.repeat(maxCols));

    let title = 'Edit file';
    let question = `Do you want to make this edit to ${filePath}?`;

    if (kind === 'create') {
      title = 'Create file';
      question = `Do you want to create ${filePath}?`;
    } else if (kind === 'overwrite') {
      title = 'Overwrite file';
      question = `Do you want to overwrite ${filePath}?`;
    }

    const allContentRows = this.renderContentRows(maxCols);

    if (mode === 'REVIEW') {
      const maxVisibleReviewLines = 15;
      const totalLines = allContentRows.length;
      const maxScroll = Math.max(0, totalLines - maxVisibleReviewLines);
      const effectiveScroll = Math.min(scrollOffset, maxScroll);

      const visibleRows = allContentRows.slice(
        effectiveScroll,
        effectiveScroll + maxVisibleReviewLines,
      );

      const element = (
        <Box flexDirection="column" width={maxCols}>
          <Text wrap="truncate">{divider}</Text>
          <Text>{''}</Text>
          <Text>{bold(c.text(`${title} (review)`))}</Text>
          <Text>{`    ${c.muted(filePath)}`}</Text>
          <Text>{''}</Text>
          {visibleRows.map((line) => (
            <Text wrap="truncate">{line}</Text>
          ))}
          <Text>{''}</Text>
          <Text>{italic(c.muted('↑/↓ scroll · Esc / f to return'))}</Text>
        </Box>
      );

      return renderElement(element, { width: maxCols });
    }

    // Normal mode: Preview first 10 lines
    const previewRows = allContentRows.slice(0, 10);
    const hiddenCount = Math.max(0, allContentRows.length - 10);

    const yesOptionText = isYesSelected
      ? `${c.permission(pointer)} ${bold(c.permission('1. Yes'))}`
      : `  ${c.text('1. Yes')}`;

    const noOptionText = isNoSelected
      ? `${c.permission(pointer)} ${bold(c.permission('2. No'))}`
      : `  ${c.text('2. No')}`;

    const element = (
      <Box flexDirection="column" width={maxCols}>
        <Text wrap="truncate">{divider}</Text>
        <Text>{''}</Text>
        <Text>{bold(c.text(title))}</Text>
        <Text>{`    ${c.muted(filePath)}`}</Text>
        <Text>{''}</Text>
        {previewRows.map((line) => (
          <Text wrap="truncate">{line}</Text>
        ))}
        {hiddenCount > 0 && (
          <Text wrap="truncate">{`    ${c.muted(`(+${hiddenCount} hidden)`)}`}</Text>
        )}
        <Text>{''}</Text>
        <Text>{c.text(question)}</Text>
        <Text>{''}</Text>
        <Text wrap="truncate">{yesOptionText}</Text>
        <Text wrap="truncate">{noOptionText}</Text>
        <Text>{''}</Text>
        <Text>{italic(c.muted('Esc to cancel · f to review'))}</Text>
      </Box>
    );

    return renderElement(element, { width: maxCols });
  }
}
