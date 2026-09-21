import { marked, type Token, type Tokens } from 'marked';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import { c, bold, italic, underline } from '../theme/style.js';
import { highlightCode } from './highlight.js';

const EOL = '\n';

let markedConfigured = false;

export function configureMarked(): void {
  if (markedConfigured) return;
  markedConfigured = true;

  marked.use({
    tokenizer: {
      del() {
        return undefined; // Disable strikethrough for ~100
      },
    },
  });
}

function padAligned(
  content: string,
  contentWidth: number,
  columnWidth: number,
  align?: 'left' | 'center' | 'right' | null,
): string {
  const padding = Math.max(0, columnWidth - contentWidth);
  if (align === 'right') {
    return ' '.repeat(padding) + content;
  }
  if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + content + ' '.repeat(rightPad);
  }
  return content + ' '.repeat(padding);
}

/**
 * Token Formatter
 */
export function formatToken(
  token: Token,
  listDepth = 0,
  orderedListNumber: number | null = null,
  parent: Token | null = null,
): string {
  switch (token.type) {
    case 'blockquote': {
      const inner = (token.tokens ?? []).map((t) => formatToken(t, 0, null, null)).join('');
      const bar = c.subtle('│');
      return inner
        .split(EOL)
        .map((line) => (stripAnsi(line).trim() ? `${bar} ${italic(line)}` : line))
        .join(EOL);
    }

    case 'code': {
      const code = token as Tokens.Code;
      const highlighted = highlightCode(code.text, { language: code.lang });
      const gutter = c.subtle('│');
      const lines = highlighted.split(EOL);
      const formatted = lines.map((line) => `  ${gutter} ${line}`).join(EOL);
      return formatted + EOL + EOL;
    }

    case 'codespan': {
      return c.permission(token.text);
    }

    case 'em': {
      return italic((token.tokens ?? []).map((t) => formatToken(t, 0, null, parent)).join(''));
    }

    case 'strong': {
      return bold((token.tokens ?? []).map((t) => formatToken(t, 0, null, parent)).join(''));
    }

    case 'heading': {
      const heading = token as Tokens.Heading;
      const text = (heading.tokens ?? []).map((t) => formatToken(t, 0, null, null)).join('');
      if (heading.depth === 1) {
        return underline(bold(c.brand(text))) + EOL + EOL;
      }
      if (heading.depth === 2) {
        return bold(c.brand(text)) + EOL + EOL;
      }
      return bold(text) + EOL + EOL;
    }

    case 'hr': {
      return c.rule('─'.repeat(40)) + EOL + EOL;
    }

    case 'link': {
      const link = token as Tokens.Link;
      const linkText = (link.tokens ?? []).map((t) => formatToken(t, 0, null, link)).join('');
      return linkText ? `${c.info(linkText)} (${c.muted(link.href)})` : link.href;
    }

    case 'list': {
      const list = token as Tokens.List;
      return (
        list.items
          .map((item: Token, index: number) =>
            formatToken(item, listDepth, list.ordered ? (list.start || 1) + index : null, list),
          )
          .join('') + EOL
      );
    }

    case 'list_item': {
      const item = token as Tokens.ListItem;
      const indent = '  '.repeat(listDepth);
      const prefix = orderedListNumber !== null ? `${orderedListNumber}.` : '•';
      const nonListTokens = item.tokens?.filter((t) => t.type !== 'list') ?? [];
      const listTokens = item.tokens?.filter((t) => t.type === 'list') ?? [];
      const mainContent = nonListTokens
        .map((t) => formatToken(t, listDepth + 1, orderedListNumber, token))
        .join('')
        .trim();
      const nestedLists = listTokens
        .map((t) => formatToken(t, listDepth + 1, null, token))
        .join('');
      return `${indent}${c.brand(prefix)} ${mainContent}${EOL}${nestedLists}`;
    }

    case 'paragraph': {
      return (token.tokens ?? []).map((t) => formatToken(t, 0, null, null)).join('') + EOL + EOL;
    }

    case 'space':
    case 'br': {
      return EOL;
    }

    case 'text': {
      if (token.tokens && token.tokens.length > 0) {
        return token.tokens
          .map((t) => formatToken(t, listDepth, orderedListNumber, token))
          .join('');
      }
      return token.text;
    }

    case 'table': {
      const tableToken = token as Tokens.Table;

      function getDisplayText(tokens: Token[] | undefined): string {
        return stripAnsi(tokens?.map((t) => formatToken(t, 0, null, null)).join('') ?? '');
      }

      const columnWidths = tableToken.header.map((header, index) => {
        let maxWidth = stringWidth(getDisplayText(header.tokens));
        for (const row of tableToken.rows) {
          const cellLength = stringWidth(getDisplayText(row[index]?.tokens));
          maxWidth = Math.max(maxWidth, cellLength);
        }
        return Math.max(maxWidth, 3);
      });

      const D = (s: string) => c.subtle(s);
      const hbar = (w: number) => '─'.repeat(w + 2);

      const topBorder = D('┌') + columnWidths.map((w) => D(hbar(w))).join(D('┬')) + D('┐');
      const midBorder = D('├') + columnWidths.map((w) => D(hbar(w))).join(D('┼')) + D('┤');
      const botBorder = D('└') + columnWidths.map((w) => D(hbar(w))).join(D('┴')) + D('┘');

      function formatRow(cells: Array<{ tokens?: Token[] }>, isHeader: boolean): string {
        const parts = columnWidths.map((w, i) => {
          const cell = cells[i];
          const raw = cell?.tokens
            ? cell.tokens.map((t) => formatToken(t, 0, null, null)).join('')
            : '';
          const plain = stripAnsi(raw);
          const align = isHeader ? 'center' : (tableToken.align?.[i] ?? 'left');
          const padded = padAligned(raw, stringWidth(plain), w, align);
          return isHeader ? ` ${bold(padded)} ` : ` ${padded} `;
        });
        return D('│') + parts.join(D('│')) + D('│');
      }

      const lines: string[] = [];
      lines.push(topBorder);
      lines.push(formatRow(tableToken.header, true));
      lines.push(midBorder);

      tableToken.rows.forEach((row, rIdx) => {
        lines.push(formatRow(row, false));
        if (rIdx < tableToken.rows.length - 1) {
          lines.push(midBorder);
        }
      });

      lines.push(botBorder);
      return lines.join(EOL) + EOL + EOL;
    }

    default: {
      return 'text' in token ? (token as any).text : '';
    }
  }
}

/**
 * Markdown Renderer
 */
export function applyMarkdown(content: string): string {
  if (!content) return '';

  configureMarked();
  const tokens = marked.lexer(content);
  return tokens
    .map((t) => formatToken(t))
    .join('')
    .trimEnd();
}
