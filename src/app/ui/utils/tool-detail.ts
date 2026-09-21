import type { ToolDetail } from '../../../packages/agents/src/tools/types.js';
import { c, bg, bold } from '../../../packages/tui/src/theme/style.js';
import { highlightCode } from '../../../packages/tui/src/format/highlight.js';

export function renderToolDetail(detail: ToolDetail): string {
  if (detail.kind === 'text') {
    return detail.text
      .split('\n')
      .map((l) => c.muted(l))
      .join('\n');
  }

  if (detail.kind === 'code') {
    const highlighted = highlightCode(detail.text, { filePath: detail.filePath });
    const contentLines = highlighted.split(/\r?\n/);
    if (contentLines.length === 0 || (contentLines.length === 1 && !contentLines[0])) {
      return '';
    }
    const cap = 50;
    const shown = contentLines.slice(0, cap);
    const padWidth = String(contentLines.length).length;
    const lines = shown.map((l, i) => `${c.muted(String(i + 1).padStart(padWidth))}  ${l}`);
    if (contentLines.length > cap) {
      lines.push(c.muted(`   … (${contentLines.length - cap} more lines)`));
    }
    return lines.join('\n');
  }

  if (detail.kind === 'diff') {
    let maxLineNum = 1;
    for (const hunk of detail.hunks) {
      for (const line of hunk.lines) {
        if (line.oldLineNumber) maxLineNum = Math.max(maxLineNum, line.oldLineNumber);
        if (line.newLineNumber) maxLineNum = Math.max(maxLineNum, line.newLineNumber);
      }
    }
    const padWidth = Math.max(1, String(maxLineNum).length);

    const diffLines: string[] = [];
    const cap = 30;
    let count = 0;
    let overflow = 0;

    for (const hunk of detail.hunks) {
      for (const line of hunk.lines) {
        if (count >= cap) {
          overflow++;
          continue;
        }
        count++;

        if (line.kind === 'deletion') {
          const numStr = String(line.oldLineNumber ?? '').padStart(padWidth, ' ');
          const body = line.spans
            ? '-' + line.spans.map((s) => (s.kind === 'deletion' ? bold(s.text) : s.text)).join('')
            : `-${line.text}`;
          diffLines.push(bg.diffDelBg(c.diffDelFg(`${numStr} ${body}`)));
        } else if (line.kind === 'addition') {
          const numStr = String(line.newLineNumber ?? '').padStart(padWidth, ' ');
          const body = line.spans
            ? '+' + line.spans.map((s) => (s.kind === 'addition' ? bold(s.text) : s.text)).join('')
            : `+${line.text}`;
          diffLines.push(bg.diffAddBg(c.diffAddFg(`${numStr} ${body}`)));
        } else {
          const numStr = String(line.newLineNumber ?? line.oldLineNumber ?? '').padStart(
            padWidth,
            ' ',
          );
          const highlightedContext = highlightCode(line.text, { filePath: detail.filePath });
          diffLines.push(`${c.muted(`${numStr} `)} ${highlightedContext}`);
        }
      }
    }

    if (overflow > 0) {
      diffLines.push(c.muted(`   … (${overflow} more lines)`));
    }

    return diffLines.join('\n');
  }

  return '';
}
