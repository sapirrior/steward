/**
 * Named constants and generator functions for ANSI / DEC / VT escape sequences.
 */

// Alternate Screen Buffer (Mode 1049)
export const ENTER_ALTERNATE_SCREEN = '\x1b[?1049h';
export const EXIT_ALTERNATE_SCREEN = '\x1b[?1049l';

// Mode 2026 Synchronized Output
export const START_SYNC_OUTPUT = '\x1b[?2026h';
export const END_SYNC_OUTPUT = '\x1b[?2026l';

// Cursor Visibility (DECTCEM - Mode 25)
export const HIDE_CURSOR = '\x1b[?25l';
export const SHOW_CURSOR = '\x1b[?25h';

// Line Autowrap (DECAWM - Mode 7)
export const DISABLE_AUTOWRAP = '\x1b[?7l';
export const ENABLE_AUTOWRAP = '\x1b[?7h';

// Cursor Positioning & Screen Clearing
export const CURSOR_HOME = '\x1b[H';
export const CLEAR_SCREEN = '\x1b[H\x1b[J';
export const CLEAR_LINE = '\x1b[2K';

/**
 * Generates an absolute Cursor Position (CUP) sequence.
 * @param row 1-indexed row number
 * @param col 1-indexed column number
 */
export function cursorTo(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

// Focus Reporting (Mode 1004)
export const ENABLE_FOCUS_REPORTING = '\x1b[?1004h';
export const DISABLE_FOCUS_REPORTING = '\x1b[?1004l';

// Bracketed Paste Mode (Mode 2004)
export const ENABLE_BRACKETED_PASTE = '\x1b[?2004h';
export const DISABLE_BRACKETED_PASTE = '\x1b[?2004l';

// SGR Mouse Reporting (Mode 1000 + 1006)
export const ENABLE_MOUSE_NORMAL = '\x1b[?1000h';
export const DISABLE_MOUSE_NORMAL = '\x1b[?1000l';
export const ENABLE_MOUSE_SGR = '\x1b[?1006h';
export const DISABLE_MOUSE_SGR = '\x1b[?1006l';

export const ENABLE_MOUSE = `${ENABLE_MOUSE_NORMAL}${ENABLE_MOUSE_SGR}`;
export const DISABLE_MOUSE = `${DISABLE_MOUSE_SGR}${DISABLE_MOUSE_NORMAL}`;
export const ENABLE_MOUSE_ALL = ENABLE_MOUSE;
export const DISABLE_MOUSE_ALL = DISABLE_MOUSE;

// Style Reset
export const RESET_SGR = '\x1b[0m';
