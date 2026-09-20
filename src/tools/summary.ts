import type { ToolDefinition, ToolSummary } from './types.js';

export function summarizeToolResult(
  toolDef: ToolDefinition<any, any> | undefined,
  args: any,
  result: any,
  isError = false,
): ToolSummary | undefined {
  if (isError) return undefined;
  if (!toolDef) {
    if (typeof result === 'string') {
      const firstLine = result.split('\n')[0]?.trim();
      return firstLine ? { headline: firstLine } : undefined;
    }
    if (result && typeof result === 'object' && typeof (result as any).message === 'string') {
      return { headline: (result as any).message };
    }
    return undefined;
  }
  if (toolDef.summarize) {
    const sum = toolDef.summarize(args, result);
    if (typeof sum === 'string') {
      const [headline, ...rest] = sum.split('\n');
      return {
        headline: headline ?? '',
        detail: rest.length > 0 ? { kind: 'text', text: rest.join('\n') } : undefined,
      };
    }
    return sum;
  }
  if (typeof result === 'string') {
    const firstLine = result.split('\n')[0]?.trim();
    return { headline: firstLine || toolDef.displayName };
  }
  if (result && typeof result === 'object' && typeof (result as any).message === 'string') {
    return { headline: (result as any).message };
  }
  return { headline: toolDef.displayName };
}

export function formatPlainToolSummary(summary: ToolSummary | undefined): string | undefined {
  if (!summary) return undefined;
  if (!summary.detail) return summary.headline;
  if (summary.detail.kind === 'text') {
    return `${summary.headline}\n${summary.detail.text}`;
  }
  if (summary.detail.kind === 'code') {
    const lines = summary.detail.text.split(/\r?\n/);
    const cap = 50;
    const shown = lines.slice(0, cap);
    const padWidth = String(lines.length).length;
    const detail = shown.map((l, i) => `${String(i + 1).padStart(padWidth)}  ${l}`).join('\n');
    const overflow = lines.length > cap ? `\n   … (${lines.length - cap} more lines)` : '';
    return `${summary.headline}\n${detail}${overflow}`;
  }
  if (summary.detail.kind === 'diff') {
    const diffLines: string[] = [];
    let maxLineNum = 1;
    for (const hunk of summary.detail.hunks) {
      for (const line of hunk.lines) {
        if (line.oldLineNumber) maxLineNum = Math.max(maxLineNum, line.oldLineNumber);
        if (line.newLineNumber) maxLineNum = Math.max(maxLineNum, line.newLineNumber);
      }
    }
    const padWidth = Math.max(1, String(maxLineNum).length);
    const cap = 30;
    let count = 0;
    let overflow = 0;

    for (const hunk of summary.detail.hunks) {
      for (const line of hunk.lines) {
        if (count >= cap) {
          overflow++;
          continue;
        }
        count++;
        if (line.kind === 'deletion') {
          const numStr = String(line.oldLineNumber ?? '').padStart(padWidth, ' ');
          diffLines.push(`${numStr} -${line.text}`);
        } else if (line.kind === 'addition') {
          const numStr = String(line.newLineNumber ?? '').padStart(padWidth, ' ');
          diffLines.push(`${numStr} +${line.text}`);
        } else {
          const numStr = String(line.newLineNumber ?? line.oldLineNumber ?? '').padStart(
            padWidth,
            ' ',
          );
          diffLines.push(`${numStr}  ${line.text}`);
        }
      }
    }
    if (overflow > 0) {
      diffLines.push(`   … (${overflow} more lines)`);
    }
    return diffLines.length > 0 ? `${summary.headline}\n${diffLines.join('\n')}` : summary.headline;
  }
  return summary.headline;
}
