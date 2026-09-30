import { SgrState } from './ansi.js';
import { graphemeWidth, segmentGraphemes, visibleWidth } from './width.js';
import { RESET_SGR } from '../terminal/sequences.js';

export interface TruncateOptions {
  mode?: 'end' | 'start' | 'middle';
  ellipsis?: string;
}

interface StyledGrapheme {
  grapheme: string;
  width: number;
  sgrBefore: string;
}

/**
 * Parses an ANSI string into a stream of user-perceived graphemes with their active SGR prefixes.
 */
function parseStyledGraphemes(text: string): { items: StyledGrapheme[]; finalSgr: string } {
  const items: StyledGrapheme[] = [];
  const ansiRegex = /\x1b\[[0-9;]*m/g;
  const sgrState = new SgrState();

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushGraphemes = (plain: string) => {
    for (const g of segmentGraphemes(plain)) {
      const w = graphemeWidth(g);
      if (w > 0) {
        items.push({
          grapheme: g,
          width: w,
          sgrBefore: sgrState.toString(),
        });
      }
    }
  };

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushGraphemes(text.slice(lastIndex, match.index));
    }
    sgrState.apply(match[0]);
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    pushGraphemes(text.slice(lastIndex));
  }

  return { items, finalSgr: sgrState.toString() };
}

/**
 * Truncates an ANSI-styled string to a maximum visible column width,
 * honoring grapheme boundaries, ellipsis, and ANSI escape state.
 */
export function truncate(text: string, maxWidth: number, options: TruncateOptions = {}): string {
  if (maxWidth <= 0) return '';
  if (visibleWidth(text) <= maxWidth) return text;

  const mode = options.mode ?? 'end';
  const ellipsis = options.ellipsis ?? '…';
  const ellipsisWidth = visibleWidth(ellipsis);

  if (maxWidth <= ellipsisWidth) {
    // Cannot fit ellipsis + content; clip ellipsis itself if needed
    return ellipsis.slice(0, maxWidth);
  }

  const availableContentWidth = maxWidth - ellipsisWidth;
  const { items } = parseStyledGraphemes(text);

  if (mode === 'end') {
    let result = '';
    let currentWidth = 0;
    let currentStyle = '';

    for (const item of items) {
      if (currentWidth + item.width > availableContentWidth) {
        break;
      }
      if (item.sgrBefore !== currentStyle) {
        if (currentStyle && !item.sgrBefore) {
          result += RESET_SGR;
        } else if (item.sgrBefore) {
          result += (currentStyle ? RESET_SGR : '') + item.sgrBefore;
        }
        currentStyle = item.sgrBefore;
      }
      result += item.grapheme;
      currentWidth += item.width;
    }

    result += (currentStyle ? RESET_SGR : '') + ellipsis;
    return result;
  }

  if (mode === 'start') {
    let currentWidth = 0;
    const chosen: StyledGrapheme[] = [];

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (currentWidth + item.width > availableContentWidth) {
        break;
      }
      chosen.unshift(item);
      currentWidth += item.width;
    }

    let result = ellipsis;
    let currentStyle = '';

    for (const item of chosen) {
      if (item.sgrBefore !== currentStyle) {
        if (currentStyle && !item.sgrBefore) {
          result += RESET_SGR;
        } else if (item.sgrBefore) {
          result += (currentStyle ? RESET_SGR : '') + item.sgrBefore;
        }
        currentStyle = item.sgrBefore;
      }
      result += item.grapheme;
    }

    if (currentStyle) result += RESET_SGR;
    return result;
  }

  if (mode === 'middle') {
    const half = Math.floor(availableContentWidth / 2);
    const leftTarget = half;
    const rightTarget = availableContentWidth - leftTarget;

    const leftChosen: StyledGrapheme[] = [];
    let leftWidth = 0;
    for (const item of items) {
      if (leftWidth + item.width > leftTarget) break;
      leftChosen.push(item);
      leftWidth += item.width;
    }

    const rightChosen: StyledGrapheme[] = [];
    let rightWidth = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]!;
      if (rightWidth + item.width > rightTarget) break;
      rightChosen.unshift(item);
      rightWidth += item.width;
    }

    let result = '';
    let currentStyle = '';

    for (const item of leftChosen) {
      if (item.sgrBefore !== currentStyle) {
        if (currentStyle && !item.sgrBefore) {
          result += RESET_SGR;
        } else if (item.sgrBefore) {
          result += (currentStyle ? RESET_SGR : '') + item.sgrBefore;
        }
        currentStyle = item.sgrBefore;
      }
      result += item.grapheme;
    }

    result += (currentStyle ? RESET_SGR : '') + ellipsis;
    currentStyle = '';

    for (const item of rightChosen) {
      if (item.sgrBefore !== currentStyle) {
        if (currentStyle && !item.sgrBefore) {
          result += RESET_SGR;
        } else if (item.sgrBefore) {
          result += (currentStyle ? RESET_SGR : '') + item.sgrBefore;
        }
        currentStyle = item.sgrBefore;
      }
      result += item.grapheme;
    }

    if (currentStyle) result += RESET_SGR;
    return result;
  }

  return text;
}

/**
 * Backward-compatible alias for truncateToWidth.
 */
export function truncateToWidth(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (visibleWidth(text) <= maxWidth) return text;
  return truncate(text, maxWidth, { mode: 'end', ellipsis: '' });
}
