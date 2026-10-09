import type { ColorLevel } from '../terminal/color.js';
import { renderAnyElement } from './Box.js';
import type { RenderContext } from './types.js';

export * from './types.js';
export * from './Text.js';
export * from './Box.js';
export * from './Newline.js';
export * from './Spacer.js';
export * from './Transform.js';
export * from './Static.js';
export * from './border.js';
export * from './style.js';
export * from './flex.js';

export function renderElement(
  element: any,
  options?: {
    width?: number;
    height?: number;
    colorLevel?: ColorLevel;
    inheritedBg?: any;
  },
): string[] {
  const context: RenderContext = {
    width: options?.width ?? 80,
    height: options?.height,
    colorLevel: options?.colorLevel ?? 3,
    inheritedBg: options?.inheritedBg,
  };
  const block = renderAnyElement(element, context);
  return block.lines;
}

export default renderElement;
