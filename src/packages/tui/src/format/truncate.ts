import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';

/**
 * Truncates an ANSI-styled string to a maximum visible column width,
 * preserving escape sequence state properly.
 */
export function truncateToWidth(styledText: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';
  if (stringWidth(stripAnsi(styledText)) <= maxWidth) return styledText;

  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
  let result = '';
  let currentWidth = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(styledText)) !== null) {
    if (match.index > lastIndex) {
      const plain = styledText.slice(lastIndex, match.index);
      for (const char of plain) {
        const w = stringWidth(char);
        if (currentWidth + w > maxWidth) {
          return result + '\x1b[0m';
        }
        result += char;
        currentWidth += w;
      }
    }
    result += match[0];
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < styledText.length) {
    const plain = styledText.slice(lastIndex);
    for (const char of plain) {
      const w = stringWidth(char);
      if (currentWidth + w > maxWidth) {
        return result + '\x1b[0m';
      }
      result += char;
      currentWidth += w;
    }
  }

  return result.includes('\x1b') && !result.endsWith('\x1b[0m') ? result + '\x1b[0m' : result;
}
