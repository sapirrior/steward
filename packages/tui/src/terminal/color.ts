import { RESET_SGR } from './sequences.js';

export type ColorLevel = 0 | 1 | 2 | 3;

export type StandardColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'grey'
  | 'blackBright'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright';

export type ColorValue =
  | StandardColorName
  | `#${string}`
  | `rgb(${string})`
  | `ansi256(${number})`
  | string
  | ((str: string) => string);

const BASIC_16_FG: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  grey: 90,
  blackBright: 90,
  redBright: 91,
  greenBright: 92,
  yellowBright: 93,
  blueBright: 94,
  magentaBright: 95,
  cyanBright: 96,
  whiteBright: 97,
};

const BASIC_16_BG: Record<string, number> = {
  black: 40,
  red: 41,
  green: 42,
  yellow: 43,
  blue: 44,
  magenta: 45,
  cyan: 46,
  white: 47,
  gray: 100,
  grey: 100,
  blackBright: 100,
  redBright: 101,
  greenBright: 102,
  yellowBright: 103,
  blueBright: 104,
  magentaBright: 105,
  cyanBright: 106,
  whiteBright: 107,
};

/**
 * Parses hex (#rgb or #rrggbb) to RGB tuple [r, g, b]
 */
function parseHex(hex: string): [number, number, number] | null {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  if (clean.length === 3) {
    const r = parseInt(clean[0]! + clean[0]!, 16);
    const g = parseInt(clean[1]! + clean[1]!, 16);
    const b = parseInt(clean[2]! + clean[2]!, 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/**
 * Downsamples RGB to closest 256-color index
 */
function rgbToAnsi256(r: number, g: number, b: number): number {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 23) + 232;
  }
  const toScale = (v: number) => Math.min(5, Math.max(0, Math.floor((v / 255) * 6)));
  return 16 + 36 * toScale(r) + 6 * toScale(g) + toScale(b);
}

/**
 * Downsamples RGB to closest 16-color code (30-37 or 90-97)
 */
function rgbToAnsi16(r: number, g: number, b: number, isBg = false): number {
  const base = isBg ? 40 : 30;
  const bright = isBg ? 100 : 90;
  const v = Math.max(r, g, b);
  if (v < 64) return isBg ? 40 : 30; // black

  const isBright = v > 192;
  const offset = isBright ? bright : base;

  let code = 0;
  if (r > 128) code += 1;
  if (g > 128) code += 2;
  if (b > 128) code += 4;
  return offset + (code % 8);
}

/**
 * Converts a ColorValue into direct ANSI SGR escape sequence
 */
export function colorToSgr(
  color: ColorValue | undefined,
  isBg = false,
  colorLevel: 0 | 1 | 2 | 3 = 3,
): string {
  if (!color || colorLevel === 0) return '';
  if (typeof color === 'function') return '';

  const normalized = color.trim().toLowerCase();

  // Basic 16 color names
  const basicMap = isBg ? BASIC_16_BG : BASIC_16_FG;
  if (basicMap[color]) {
    return `\x1b[${basicMap[color]}m`;
  }
  if (basicMap[normalized]) {
    return `\x1b[${basicMap[normalized]}m`;
  }

  // Hex colors: #rgb or #rrggbb
  if (normalized.startsWith('#')) {
    const rgb = parseHex(normalized);
    if (rgb) {
      const [r, g, b] = rgb;
      if (colorLevel >= 3) {
        return `\x1b[${isBg ? 48 : 38};2;${r};${g};${b}m`;
      }
      if (colorLevel === 2) {
        return `\x1b[${isBg ? 48 : 38};5;${rgbToAnsi256(r, g, b)}m`;
      }
      return `\x1b[${rgbToAnsi16(r, g, b, isBg)}m`;
    }
  }

  // rgb(r, g, b)
  if (normalized.startsWith('rgb(') && normalized.endsWith(')')) {
    const parts = normalized
      .slice(4, -1)
      .split(',')
      .map((p) => parseInt(p.trim(), 10) || 0);
    if (parts.length >= 3) {
      const [r, g, b] = [parts[0]!, parts[1]!, parts[2]!];
      if (colorLevel >= 3) {
        return `\x1b[${isBg ? 48 : 38};2;${r};${g};${b}m`;
      }
      if (colorLevel === 2) {
        return `\x1b[${isBg ? 48 : 38};5;${rgbToAnsi256(r, g, b)}m`;
      }
      return `\x1b[${rgbToAnsi16(r, g, b, isBg)}m`;
    }
  }

  // ansi256(n)
  if (normalized.startsWith('ansi256(') && normalized.endsWith(')')) {
    const n = parseInt(normalized.slice(8, -1).trim(), 10) || 0;
    if (colorLevel >= 2) {
      return `\x1b[${isBg ? 48 : 38};5;${n}m`;
    }
  }

  return '';
}

/**
 * Applies a color to text using direct SGR emission
 */
export function styleText(
  text: string,
  options: {
    color?: ColorValue;
    backgroundColor?: ColorValue;
    bold?: boolean;
    dim?: boolean;
    italic?: boolean;
    underline?: boolean;
    inverse?: boolean;
    strikethrough?: boolean;
    colorLevel?: 0 | 1 | 2 | 3;
  } = {},
): string {
  if (!text) return '';

  if (typeof options.color === 'function') {
    text = options.color(text);
  }
  if (typeof options.backgroundColor === 'function') {
    text = options.backgroundColor(text);
  }

  let prefix = '';
  const level = options.colorLevel ?? 3;

  if (options.bold) prefix += '\x1b[1m';
  if (options.dim) prefix += '\x1b[2m';
  if (options.italic) prefix += '\x1b[3m';
  if (options.underline) prefix += '\x1b[4m';
  if (options.inverse) prefix += '\x1b[7m';
  if (options.strikethrough) prefix += '\x1b[9m';

  if (typeof options.color === 'string') {
    prefix += colorToSgr(options.color, false, level);
  }
  if (typeof options.backgroundColor === 'string') {
    prefix += colorToSgr(options.backgroundColor, true, level);
  }

  if (!prefix) return text;
  return `${prefix}${text}${RESET_SGR}`;
}
