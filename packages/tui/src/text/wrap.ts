import { SgrState } from './ansi.js';
import { expandTabs, graphemeWidth, segmentGraphemes, visibleWidth, visibleColumnAtOffset } from './width.js';
import { RESET_SGR } from '../terminal/sequences.js';

export interface WrapResultWithCursor {
  segments: string[];
  cursorInLine: { segmentIndex: number; column: number } | null;
}

interface AnsiWrapToken {
  type: 'ansi' | 'grapheme';
  value: string;
  width: number;
}

interface LayoutChunk {
  isSpace: boolean;
  tokens: AnsiWrapToken[];
  width: number;
}

/**
 * Tokenizes text into ANSI escape sequences and grapheme clusters.
 */
function tokenizeText(text: string): AnsiWrapToken[] {
  const tokens: AnsiWrapToken[] = [];
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      for (const g of segmentGraphemes(plain)) {
        tokens.push({
          type: 'grapheme',
          value: g,
          width: graphemeWidth(g),
        });
      }
    }
    tokens.push({
      type: 'ansi',
      value: match[0],
      width: 0,
    });
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex);
    for (const g of segmentGraphemes(plain)) {
      tokens.push({
        type: 'grapheme',
        value: g,
        width: graphemeWidth(g),
      });
    }
  }

  return tokens;
}

/**
 * Groups tokens into word chunks and whitespace chunks.
 */
function groupIntoChunks(tokens: AnsiWrapToken[]): LayoutChunk[] {
  const chunks: LayoutChunk[] = [];
  let currentChunk: LayoutChunk | null = null;

  for (const token of tokens) {
    if (token.type === 'ansi') {
      if (!currentChunk) {
        currentChunk = { isSpace: false, tokens: [], width: 0 };
      }
      currentChunk.tokens.push(token);
      continue;
    }

    const isSpace = token.value === ' ';
    if (!currentChunk || currentChunk.isSpace !== isSpace) {
      if (currentChunk && currentChunk.tokens.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = { isSpace, tokens: [token], width: token.width };
    } else {
      currentChunk.tokens.push(token);
      currentChunk.width += token.width;
    }
  }

  if (currentChunk && currentChunk.tokens.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Wraps `text` into lines that do not exceed `maxCols` display columns using word-boundary wrapping,
 * and simultaneously maps a logical character offset to its physical (segmentIndex, column).
 * Automatically preserves and applies hanging indentation across wrapped lines.
 */
export function wrapVisualLineWithCursor(
  text: string,
  maxCols: number,
  targetCharOffset: number | null,
  hangingIndent: number | string = 0,
): WrapResultWithCursor {
  // Normalize line breaks while strictly preserving character offsets
  text = expandTabs(text.replace(/\r\n/g, '  ').replace(/\r|\n/g, ' '));

  if (text.length === 0) {
    return {
      segments: [''],
      cursorInLine: targetCharOffset !== null ? { segmentIndex: 0, column: 1 } : null,
    };
  }
  if (maxCols <= 0) {
    return {
      segments: [text],
      cursorInLine:
        targetCharOffset !== null
          ? {
              segmentIndex: 0,
              column: visibleColumnAtOffset(text, targetCharOffset),
            }
          : null,
    };
  }

  const continuationIndent =
    typeof hangingIndent === 'number'
      ? hangingIndent > 0
        ? ' '.repeat(hangingIndent)
        : ''
      : (hangingIndent ?? '');

  const tokens = tokenizeText(text);
  const chunks = groupIntoChunks(tokens);

  const lines: string[] = [];
  let currentTokens: AnsiWrapToken[] = [];
  let currentWidth = 0;
  const sgrState = new SgrState();

  let plainCharIndex = 0;
  let cursorFound = false;
  let cursorSegment = 0;
  let cursorColumn = 1;

  function emitCurrentLine() {
    const activeStyleStr = sgrState.toString();
    let lineStr = currentTokens.map((t) => t.value).join('');
    if (activeStyleStr.length > 0 && !lineStr.endsWith(RESET_SGR)) {
      lineStr += RESET_SGR;
    }
    lines.push(lineStr);

    currentTokens = [];
    currentWidth = 0;

    // Apply hanging continuation indent to next line
    if (continuationIndent) {
      if (activeStyleStr.length > 0) {
        currentTokens.push({ type: 'ansi', value: activeStyleStr, width: 0 });
      }
      const contTokens = tokenizeText(continuationIndent);
      for (const t of contTokens) {
        currentTokens.push(t);
      }
      currentWidth = visibleWidth(continuationIndent);
    } else if (activeStyleStr.length > 0) {
      currentTokens.push({ type: 'ansi', value: activeStyleStr, width: 0 });
    }
  }

  function checkCursorAtCurrentToken() {
    if (targetCharOffset !== null && !cursorFound && plainCharIndex === targetCharOffset) {
      cursorFound = true;
      cursorSegment = lines.length;
      cursorColumn = 1 + currentWidth;
    }
  }

  for (const chunk of chunks) {
    if (chunk.isSpace) {
      // Leading whitespace (indentation) is always preserved
      if (currentWidth === 0) {
        for (const token of chunk.tokens) {
          if (token.type === 'ansi') {
            sgrState.apply(token.value);
          } else {
            checkCursorAtCurrentToken();
            plainCharIndex += token.value.length;
            currentWidth += token.width;
          }
          currentTokens.push(token);
        }
      } else if (currentWidth + chunk.width <= maxCols) {
        for (const token of chunk.tokens) {
          if (token.type === 'ansi') {
            sgrState.apply(token.value);
          } else {
            checkCursorAtCurrentToken();
            plainCharIndex += token.value.length;
            currentWidth += token.width;
          }
          currentTokens.push(token);
        }
      } else {
        // Trailing whitespace at end of line
        for (const token of chunk.tokens) {
          if (token.type === 'grapheme') {
            checkCursorAtCurrentToken();
            plainCharIndex += token.value.length;
          }
        }
        emitCurrentLine();
        for (const token of chunk.tokens) {
          if (token.type === 'ansi') {
            sgrState.apply(token.value);
            currentTokens.push(token);
          }
        }
      }
      continue;
    }

    // Word chunk (non-space)
    if (currentWidth + chunk.width <= maxCols) {
      for (const token of chunk.tokens) {
        if (token.type === 'ansi') {
          sgrState.apply(token.value);
        } else {
          checkCursorAtCurrentToken();
          plainCharIndex += token.value.length;
          currentWidth += token.width;
        }
        currentTokens.push(token);
      }
    } else if (currentWidth > 0) {
      emitCurrentLine();

      if (currentWidth + chunk.width <= maxCols) {
        for (const token of chunk.tokens) {
          if (token.type === 'ansi') {
            sgrState.apply(token.value);
          } else {
            checkCursorAtCurrentToken();
            plainCharIndex += token.value.length;
            currentWidth += token.width;
          }
          currentTokens.push(token);
        }
      } else {
        // Super-long word: break grapheme-by-grapheme
        for (const token of chunk.tokens) {
          if (token.type === 'ansi') {
            sgrState.apply(token.value);
            currentTokens.push(token);
            continue;
          }
          if (currentWidth + token.width > maxCols && currentWidth > 0) {
            emitCurrentLine();
          }
          checkCursorAtCurrentToken();
          plainCharIndex += token.value.length;
          currentTokens.push(token);
          currentWidth += token.width;
        }
      }
    } else {
      // Empty line super-long word
      for (const token of chunk.tokens) {
        if (token.type === 'ansi') {
          sgrState.apply(token.value);
          currentTokens.push(token);
          continue;
        }
        if (currentWidth + token.width > maxCols && currentWidth > 0) {
          emitCurrentLine();
        }
        checkCursorAtCurrentToken();
        plainCharIndex += token.value.length;
        currentTokens.push(token);
        currentWidth += token.width;
      }
    }
  }

  if (currentTokens.length > 0 || lines.length === 0) {
    const activeStyleStr = sgrState.toString();
    if (sgrState.bg && currentWidth < maxCols) {
      const remainingCols = maxCols - currentWidth;
      currentTokens.push({
        type: 'grapheme',
        value: ' '.repeat(remainingCols),
        width: remainingCols,
      });
      currentWidth = maxCols;
    }

    let lineStr = currentTokens.map((t) => t.value).join('');
    if (activeStyleStr.length > 0 && !lineStr.endsWith(RESET_SGR)) {
      lineStr += RESET_SGR;
    }
    lines.push(lineStr);
  }

  if (targetCharOffset !== null && !cursorFound) {
    cursorSegment = Math.max(0, lines.length - 1);
    cursorColumn = 1 + currentWidth;
    cursorFound = true;
  }

  const finalColumn = maxCols > 0 ? Math.max(1, Math.min(maxCols, cursorColumn)) : cursorColumn;

  return {
    segments: lines,
    cursorInLine:
      targetCharOffset !== null ? { segmentIndex: cursorSegment, column: finalColumn } : null,
  };
}

/**
 * Wraps `text` into lines that do not exceed `maxCols` display columns using word-boundary wrapping.
 * Automatically preserves and applies hanging indentation across wrapped lines.
 */
export function wrapVisualLine(
  text: string,
  maxCols: number,
  hangingIndent: number | string = 0,
): string[] {
  return wrapVisualLineWithCursor(text, maxCols, null, hangingIndent).segments;
}
