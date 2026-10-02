import { expandTabs, segmentGraphemes } from './width.js';

/**
 * Sanitizes an untrusted string to ensure only printable graphemes and valid SGR escape sequences reach the terminal.
 * Drops raw OSC, non-SGR CSI, DEC private modes, and unsafe C0/C1 control characters.
 */
export function sanitize(text: string): string {
  if (!text) return '';

  const expanded = expandTabs(text);
  const sgrOrOtherRegex =
    /(\x1b\[[0-9;]*m)|(\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[a-zA-Z]|\x9b[0-9;]*[a-zA-Z]|\x1b[=>NOWc])/g;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const processPlainText = (plain: string) => {
    const graphemes = segmentGraphemes(plain);
    for (const g of graphemes) {
      if (g.length === 1) {
        const code = g.charCodeAt(0);
        // Allow printable ASCII and newline
        if (code >= 32 && code !== 127) {
          result += g;
        } else if (code === 10 || code === 13) {
          result += g;
        }
      } else {
        // Multi-byte Unicode / Emoji
        result += g;
      }
    }
  };

  while ((match = sgrOrOtherRegex.exec(expanded)) !== null) {
    if (match.index > lastIndex) {
      processPlainText(expanded.slice(lastIndex, match.index));
    }
    // If it's a valid SGR sequence, keep it
    if (match[1]) {
      result += match[1];
    }
    // Non-SGR escapes (OSC, cursor movement, etc.) are safely dropped
    lastIndex = sgrOrOtherRegex.lastIndex;
  }

  if (lastIndex < expanded.length) {
    processPlainText(expanded.slice(lastIndex));
  }

  return result;
}
