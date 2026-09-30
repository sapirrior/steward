import { colorToSgr, type ColorLevel } from '../terminal/color.js';
import { RESET_SGR } from '../terminal/sequences.js';
import type { TextStyleProps, ColorValue } from './types.js';

export interface StyleFrame extends TextStyleProps {
  parentBg?: ColorValue;
}

export function buildSgrPrefix(props: TextStyleProps, colorLevel: ColorLevel): string {
  let sgr = '';
  if (props.bold) sgr += '\x1b[1m';
  if (props.dimColor) sgr += '\x1b[2m';
  if (props.italic) sgr += '\x1b[3m';
  if (props.underline) sgr += '\x1b[4m';
  if (props.inverse) sgr += '\x1b[7m';
  if (props.strikethrough) sgr += '\x1b[9m';

  if (typeof props.color === 'string') {
    sgr += colorToSgr(props.color, false, colorLevel);
  }
  if (typeof props.backgroundColor === 'string') {
    sgr += colorToSgr(props.backgroundColor, true, colorLevel);
  }
  return sgr;
}

export function applyStyleFrame(
  text: string,
  current: TextStyleProps,
  parent: TextStyleProps | null,
  colorLevel: ColorLevel,
): string {
  if (!text) return '';

  let styledText = text;
  if (typeof current.color === 'function') {
    styledText = current.color(styledText);
  }
  if (typeof current.backgroundColor === 'function') {
    styledText = current.backgroundColor(styledText);
  }

  const prefix = buildSgrPrefix(current, colorLevel);
  if (!prefix) return styledText;

  // On close, restore parent style if one exists, otherwise RESET_SGR
  const parentPrefix = parent ? buildSgrPrefix(parent, colorLevel) : '';
  const suffix = parentPrefix ? `${RESET_SGR}${parentPrefix}` : RESET_SGR;

  return `${prefix}${styledText}${suffix}`;
}

export function mergeStyles(parent: TextStyleProps | null, child: TextStyleProps): TextStyleProps {
  if (!parent) return { ...child };
  return {
    color: child.color ?? parent.color,
    backgroundColor: child.backgroundColor ?? parent.backgroundColor,
    dimColor: child.dimColor ?? parent.dimColor,
    bold: child.bold ?? parent.bold,
    italic: child.italic ?? parent.italic,
    underline: child.underline ?? parent.underline,
    strikethrough: child.strikethrough ?? parent.strikethrough,
    inverse: child.inverse ?? parent.inverse,
  };
}
