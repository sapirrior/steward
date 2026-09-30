/**
 * Unified ANSI SGR and Escape Sequence Parser & State Tracker
 */

export interface AnsiToken {
  type: 'ansi' | 'grapheme';
  value: string;
  width: number;
}

export class SgrState {
  fg: string | null = null;
  bg: string | null = null;
  modifiers = new Set<string>();

  clear(): void {
    this.fg = null;
    this.bg = null;
    this.modifiers.clear();
  }

  apply(sgrSequence: string): void {
    const match = sgrSequence.match(/^\x1b\[([0-9;]*)m$/);
    if (!match) return;

    const rawParams = match[1] || '0';
    const params = rawParams.split(';').map((p) => parseInt(p, 10) || 0);

    let i = 0;
    while (i < params.length) {
      const code = params[i] ?? 0;

      if (code === 0) {
        this.clear();
      } else if (
        code === 1 || // Bold
        code === 2 || // Dim
        code === 3 || // Italic
        code === 4 || // Underline
        code === 7 || // Inverse
        code === 8 || // Hidden
        code === 9 // Strikethrough
      ) {
        this.modifiers.add(`\x1b[${code}m`);
      } else if (code === 22) {
        this.modifiers.delete('\x1b[1m');
        this.modifiers.delete('\x1b[2m');
      } else if (code === 23) {
        this.modifiers.delete('\x1b[3m');
      } else if (code === 24) {
        this.modifiers.delete('\x1b[4m');
      } else if (code === 27) {
        this.modifiers.delete('\x1b[7m');
      } else if (code === 28) {
        this.modifiers.delete('\x1b[8m');
      } else if (code === 29) {
        this.modifiers.delete('\x1b[9m');
      } else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
        this.fg = `\x1b[${code}m`;
      } else if (code === 38) {
        if (params[i + 1] === 5 && i + 2 < params.length) {
          this.fg = `\x1b[38;5;${params[i + 2]}m`;
          i += 2;
        } else if (params[i + 1] === 2 && i + 4 < params.length) {
          this.fg = `\x1b[38;2;${params[i + 2]};${params[i + 3]};${params[i + 4]}m`;
          i += 4;
        }
      } else if (code === 39) {
        this.fg = null;
      } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
        this.bg = `\x1b[${code}m`;
      } else if (code === 48) {
        if (params[i + 1] === 5 && i + 2 < params.length) {
          this.bg = `\x1b[48;5;${params[i + 2]}m`;
          i += 2;
        } else if (params[i + 1] === 2 && i + 4 < params.length) {
          this.bg = `\x1b[48;2;${params[i + 2]};${params[i + 3]};${params[i + 4]}m`;
          i += 4;
        }
      } else if (code === 49) {
        this.bg = null;
      }

      i++;
    }
  }

  clone(): SgrState {
    const copy = new SgrState();
    copy.fg = this.fg;
    copy.bg = this.bg;
    copy.modifiers = new Set(this.modifiers);
    return copy;
  }

  toString(): string {
    let s = '';
    if (this.fg) s += this.fg;
    if (this.bg) s += this.bg;
    for (const mod of this.modifiers) {
      s += mod;
    }
    return s;
  }
}

/**
 * Regular expression matching ANSI escapes (CSI, OSC, DEC private, etc.)
 */
export const ANSI_ESCAPE_REGEX =
  /(?:\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[=>NOWc]|\x9b[0-9;]*[a-zA-Z])/g;

/**
 * Strips all ANSI escape sequences from a string without external dependencies.
 */
export function stripAnsi(text: string): string {
  if (!text || !text.includes('\x1b')) return text;
  return text.replace(ANSI_ESCAPE_REGEX, '');
}
