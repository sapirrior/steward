import Component from '@steward/tui/engine/Component.js';
import { figures } from '@steward/tui/theme/index.js';
import { c, bg, bold, italic } from '@steward/tui/theme/style.js';
import {
  Box,
  Text,
  parseKeyInput,
  prefixedBlock,
} from '@steward/tui/primitives/index.js';
import type { FilePermissionRequest } from '@steward/agents/tools/types.js';
import { buildUnifiedDiff, type UnifiedDiff } from '@steward/services/diff/diff.js';
import { highlightCode } from '@steward/tui/format/highlight.js';

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

export default class FilePermissionDock extends Component<
  FilePermissionDockProps,
  FilePermissionDockState
> {
  override wrap = true;
  override clip = false;

  private removeInputListener: (() => void) | null = null;

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

    this.removeInputListener = this.engine.addInputListener((chunk) => {
      const action = parseKeyInput(chunk);
      const rawStr = chunk.toString();

      if (this.state.mode === 'NORMAL') {
        // 'f' enters review mode
        if (rawStr === 'f' || rawStr === 'F') {
          this.setState({ mode: 'REVIEW', scrollOffset: 0 });
          return true;
        }

        // Up / Down toggles selection
        if (action.type === 'cursor-up' || action.type === 'cursor-down') {
          this.setState({
            selectedIndex: this.state.selectedIndex === 0 ? 1 : 0,
          });
          return true;
        }

        // Numeric direct selection
        if (rawStr === '1') {
          this.setState({ selectedIndex: 0 });
          return true;
        }
        if (rawStr === '2') {
          this.setState({ selectedIndex: 1 });
          return true;
        }

        // Submit
        if (action.type === 'submit') {
          this.props.onDecision(this.state.selectedIndex === 0);
          return true;
        }

        // Esc cancels (denies)
        if (action.type === 'escape') {
          this.props.onDecision(false);
          return true;
        }
      } else if (this.state.mode === 'REVIEW') {
        // 'f' or Esc returns to normal permission mode
        if (rawStr === 'f' || rawStr === 'F' || action.type === 'escape') {
          this.setState({ mode: 'NORMAL', scrollOffset: 0 });
          return true;
        }

        // Up / Down scrolls review output
        if (action.type === 'cursor-up') {
          this.setState({
            scrollOffset: Math.max(0, this.state.scrollOffset - 1),
          });
          return true;
        }
        if (action.type === 'cursor-down') {
          const maxScroll = this.getMaxScroll();
          this.setState({
            scrollOffset: Math.min(maxScroll, this.state.scrollOffset + 1),
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
    const termWidth = process.stdout.columns || 80;
    const allContentRows = this.renderContentRows(termWidth);
    const maxVisibleReviewLines = 15;
    return Math.max(0, allContentRows.length - maxVisibleReviewLines);
  }

  private renderContentRows(maxCols: number): string[] {
    const { request } = this.props;
    const { kind, before, after } = request;

    if (kind === 'create' || kind === 'overwrite') {
      const highlighted = highlightCode(after, { filePath: request.filePath });
      const rawLines = highlighted.split(/\r?\n/);
      // Handle trailing newline splitting edge case
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

    // Calculate maximum line number for uniform gutter
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
          const highlightedLine = highlightCode(line.text, { filePath: request.filePath });
          const wrapped = prefixedBlock(firstPrefix, highlightedLine, {
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
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);

    const { mode, selectedIndex, scrollOffset } = this.state;
    const { request } = this.props;
    const { kind, filePath } = request;

    const pointer = figures.pointerBold ?? '❯';
    const isYesSelected = selectedIndex === 0;
    const isNoSelected = selectedIndex === 1;

    // Divider line
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
        <Box direction="column" width={maxCols} wrap={true} clip={false}>
          <Text wrap={false} clip={true}>
            {divider}
          </Text>
          <Text wrap={false} clip={false}>
            {''}
          </Text>
          <Text wrap={false} clip={false}>
            {bold(c.text(`${title} (review)`))}
          </Text>
          <Text wrap={false} clip={false}>
            {`    ${c.muted(filePath)}`}
          </Text>
          <Text wrap={false} clip={false}>
            {''}
          </Text>
          {visibleRows.map((line) => (
            <Text wrap={false} clip={false}>
              {line}
            </Text>
          ))}
          <Text wrap={false} clip={false}>
            {''}
          </Text>
          <Text wrap={false} clip={false}>
            {italic(c.muted('↑/↓ scroll · Esc / f to return'))}
          </Text>
        </Box>
      );

      return element.render(maxCols);
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
      <Box direction="column" width={maxCols} wrap={true} clip={false}>
        <Text wrap={false} clip={true}>
          {divider}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {bold(c.text(title))}
        </Text>
        <Text wrap={false} clip={false}>
          {`    ${c.muted(filePath)}`}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        {previewRows.map((line) => (
          <Text wrap={false} clip={false}>
            {line}
          </Text>
        ))}
        {hiddenCount > 0 && (
          <Text wrap={false} clip={false}>
            {`    ${c.muted(`(+${hiddenCount} hidden)`)}`}
          </Text>
        )}
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {c.text(question)}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {yesOptionText}
        </Text>
        <Text wrap={false} clip={false}>
          {noOptionText}
        </Text>
        <Text wrap={false} clip={false}>
          {''}
        </Text>
        <Text wrap={false} clip={false}>
          {italic(c.muted('Esc to cancel · f to review'))}
        </Text>
      </Box>
    );

    return element.render(maxCols);
  }
}
