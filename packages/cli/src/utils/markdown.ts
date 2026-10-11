/**
 * @file markdown.ts
 * @description Markdown formatting utilities and marked token formatting
 * with 1:1 visual parity to Claude Code.
 */

import chalk from 'chalk';
import { marked, type Token, type Tokens } from 'marked';
import stripAnsi from 'strip-ansi';
import stringWidth from 'string-width';
import { BLOCKQUOTE_BAR } from '../constants/figures.js';
import { getTheme, themeColorToAnsi, themeManager } from '../themes/index.js';
import type { ThemeName } from '../themes/themeTypes.js';

const EOL = '\n';

// Force chalk color formatting support in terminal
chalk.level = 3;

let markedConfigured = false;

export function configureMarked(): void {
  if (markedConfigured) return;
  markedConfigured = true;

  // Disable strikethrough parsing (~ is often used for approximate numbers)
  marked.use({
    tokenizer: {
      del() {
        return undefined;
      },
    },
  });
}

function getPermissionColor(theme?: ThemeName): (str: string) => string {
  const currentPalette = theme ? getTheme(theme) : themeManager.theme;
  const rawColor = currentPalette.permission;
  const ansiPrefix = themeColorToAnsi(rawColor);
  return (s: string) => `${ansiPrefix}${s}\x1b[39m`;
}

/**
 * Format individual markdown token to ANSI-styled string matching Claude Code.
 */
export function formatToken(
  token: Token,
  theme?: ThemeName,
  listDepth = 0,
  orderedListNumber: number | null = null,
  parent: Token | null = null,
): string {
  switch (token.type) {
    case 'blockquote': {
      const inner = (token.tokens ?? [])
        .map((t) => formatToken(t, theme, 0, null, null))
        .join('');
      const bar = chalk.dim(BLOCKQUOTE_BAR);
      return inner
        .split(EOL)
        .map((line) => (stripAnsi(line).trim() ? `${bar} ${chalk.italic(line)}` : line))
        .join(EOL);
    }

    case 'code': {
      return token.text + EOL;
    }

    case 'codespan': {
      // inline code uses theme 'permission' color
      const colorFn = getPermissionColor(theme);
      return colorFn(token.text);
    }

    case 'em': {
      return chalk.italic(
        (token.tokens ?? [])
          .map((t) => formatToken(t, theme, 0, null, parent))
          .join(''),
      );
    }

    case 'strong': {
      return chalk.bold(
        (token.tokens ?? [])
          .map((t) => formatToken(t, theme, 0, null, parent))
          .join(''),
      );
    }

    case 'heading': {
      switch (token.depth) {
        case 1:
          return (
            chalk.bold.italic.underline(
              (token.tokens ?? [])
                .map((t) => formatToken(t, theme, 0, null, null))
                .join(''),
            ) +
            EOL +
            EOL
          );
        case 2:
        default:
          return (
            chalk.bold(
              (token.tokens ?? [])
                .map((t) => formatToken(t, theme, 0, null, null))
                .join(''),
            ) +
            EOL +
            EOL
          );
      }
    }

    case 'hr':
      return '---' + EOL;

    case 'image':
      return token.href;

    case 'link': {
      if (token.href.startsWith('mailto:')) {
        return token.href.replace(/^mailto:/, '');
      }
      const linkText = (token.tokens ?? [])
        .map((t) => formatToken(t, theme, 0, null, token))
        .join('');
      const plainLinkText = stripAnsi(linkText);
      if (plainLinkText && plainLinkText !== token.href) {
        return `${linkText} (${token.href})`;
      }
      return token.href;
    }

    case 'list': {
      return token.items
        .map((item: Token, index: number) =>
          formatToken(
            item,
            theme,
            listDepth,
            token.ordered ? token.start + index : null,
            token,
          ),
        )
        .join('');
    }

    case 'list_item': {
      return (token.tokens ?? [])
        .map(
          (t) =>
            `${'  '.repeat(listDepth)}${formatToken(t, theme, listDepth + 1, orderedListNumber, token)}`,
        )
        .join('');
    }

    case 'paragraph': {
      return (
        (token.tokens ?? [])
          .map((t) => formatToken(t, theme, 0, null, null))
          .join('') + EOL
      );
    }

    case 'space':
    case 'br':
      return EOL;

    case 'text': {
      if (parent?.type === 'link') {
        return token.text;
      }
      if (parent?.type === 'list_item') {
        const bullet = orderedListNumber === null ? '-' : `${getListNumber(listDepth, orderedListNumber)}.`;
        const inner = token.tokens
          ? token.tokens.map((t) => formatToken(t, theme, listDepth, orderedListNumber, token)).join('')
          : token.text;
        return `${bullet} ${inner}${EOL}`;
      }
      return token.text;
    }

    case 'table': {
      const tableToken = token as Tokens.Table;

      function getDisplayText(tokens: Token[] | undefined): string {
        return stripAnsi(
          tokens?.map((t) => formatToken(t, theme, 0, null, null)).join('') ?? '',
        );
      }

      const columnWidths = tableToken.header.map((header, index) => {
        let maxWidth = stringWidth(getDisplayText(header.tokens));
        for (const row of tableToken.rows) {
          const cellLength = stringWidth(getDisplayText(row[index]?.tokens));
          maxWidth = Math.max(maxWidth, cellLength);
        }
        return Math.max(maxWidth, 3);
      });

      let tableOutput = '| ';
      tableToken.header.forEach((header, index) => {
        const content =
          header.tokens?.map((t) => formatToken(t, theme, 0, null, null)).join('') ?? '';
        const displayText = getDisplayText(header.tokens);
        const width = columnWidths[index]!;
        const align = tableToken.align?.[index];
        tableOutput += padAligned(content, stringWidth(displayText), width, align) + ' | ';
      });
      tableOutput = tableOutput.trimEnd() + EOL;

      tableOutput += '|';
      columnWidths.forEach((width) => {
        tableOutput += '-'.repeat(width + 2) + '|';
      });
      tableOutput += EOL;

      tableToken.rows.forEach((row) => {
        tableOutput += '| ';
        row.forEach((cell, index) => {
          const content =
            cell.tokens?.map((t) => formatToken(t, theme, 0, null, null)).join('') ?? '';
          const displayText = getDisplayText(cell.tokens);
          const width = columnWidths[index]!;
          const align = tableToken.align?.[index];
          tableOutput += padAligned(content, stringWidth(displayText), width, align) + ' | ';
        });
        tableOutput = tableOutput.trimEnd() + EOL;
      });

      return tableOutput + EOL;
    }

    case 'escape':
      return token.text;

    case 'def':
    case 'del':
    case 'html':
      return '';
  }

  return '';
}

function numberToLetter(n: number): string {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(97 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

const ROMAN_VALUES: ReadonlyArray<[number, string]> = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];

function numberToRoman(n: number): string {
  let result = '';
  for (const [value, numeral] of ROMAN_VALUES) {
    while (n >= value) {
      result += numeral;
      n -= value;
    }
  }
  return result;
}

function getListNumber(listDepth: number, orderedListNumber: number): string {
  switch (listDepth) {
    case 0:
    case 1:
      return orderedListNumber.toString();
    case 2:
      return numberToLetter(orderedListNumber);
    case 3:
      return numberToRoman(orderedListNumber);
    default:
      return orderedListNumber.toString();
  }
}

export function padAligned(
  content: string,
  displayWidth: number,
  targetWidth: number,
  align: 'left' | 'center' | 'right' | null | undefined,
): string {
  const padding = Math.max(0, targetWidth - displayWidth);
  if (align === 'center') {
    const leftPad = Math.floor(padding / 2);
    return ' '.repeat(leftPad) + content + ' '.repeat(padding - leftPad);
  }
  if (align === 'right') {
    return ' '.repeat(padding) + content;
  }
  return content + ' '.repeat(padding);
}

const STRIPPED_TAGS_RE =
  /<(commit_analysis|context|function_analysis|pr_analysis)>.*?<\/\1>\n?/gs;

/**
 * Strips hidden XML analysis tags from prompt/message content.
 */
export function stripPromptXMLTags(content: unknown): string {
  if (typeof content !== 'string') {
    if (content === null || content === undefined) return '';
    return String(content);
  }
  return content.replace(STRIPPED_TAGS_RE, '').trim();
}

const MD_SYNTAX_RE = /[#*`|[>\-_~]|\n\n|^\d+\. |\n\d+\. /;

export function hasMarkdownSyntax(s: string): boolean {
  return MD_SYNTAX_RE.test(s.length > 500 ? s.slice(0, 500) : s);
}

/**
 * Apply markdown rendering to a string with ANSI formatting.
 */
export function applyMarkdown(content: unknown, theme?: ThemeName): string {
  configureMarked();
  const cleaned = stripPromptXMLTags(content);
  if (!cleaned || !hasMarkdownSyntax(cleaned)) {
    return cleaned;
  }
  const tokens = marked.lexer(cleaned);
  return tokens
    .map((t) => formatToken(t, theme, 0, null, null))
    .join('')
    .trimEnd();
}
