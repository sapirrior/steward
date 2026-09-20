import chalk, { type ChalkInstance } from 'chalk';

/**
 * Resolves a theme color definition into a chalk colorizer instance.
 * Supports:
 * - 'rgb(r,g,b)' -> chalk.rgb(...) / chalk.bgRgb(...)
 * - '#hex' -> chalk.hex(...) / chalk.bgHex(...)
 * - 'ansi(name)' -> chalk[name] (e.g. ansi(green), ansi(bgGreen), ansi(yellowBright), ansi(reset))
 */
export function resolveThemeColor(color: string, isBg = false): ChalkInstance {
  if (!color || color === 'none' || color === 'transparent' || color === 'ansi(reset)') {
    return chalk.visible;
  }

  if (color.startsWith('ansi(') && color.endsWith(')')) {
    const name = color.slice(5, -1).trim();
    if (name === 'reset' || name === 'none' || name === 'transparent' || name === 'default') {
      return chalk.visible;
    }
    if (isBg && !name.startsWith('bg')) {
      const bgName = `bg${name.charAt(0).toUpperCase()}${name.slice(1)}`;
      const fn = (chalk as any)[bgName];
      if (typeof fn === 'function') return fn;
    }
    const fn = (chalk as any)[name];
    if (typeof fn === 'function') return fn;
    return chalk.visible;
  }

  if (color.startsWith('rgb(')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = [Number(match[0]), Number(match[1]), Number(match[2])];
      return isBg ? chalk.bgRgb(r, g, b) : chalk.rgb(r, g, b);
    }
  }

  return isBg ? chalk.bgHex(color) : chalk.hex(color);
}
