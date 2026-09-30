import { renderElement } from '../elements/index.js';
import type { ColorLevel } from '../terminal/color.js';

export interface RenderToStringOptions {
  columns?: number;
  rows?: number;
  colorLevel?: ColorLevel;
}

/**
 * Renders an element tree directly to an ANSI string.
 */
export function renderToString(
  element: any,
  options: RenderToStringOptions = {},
): string {
  const width = options.columns ?? 80;
  const lines = renderElement(element, {
    width,
    colorLevel: options.colorLevel ?? 3,
  });

  if (options.rows && lines.length > options.rows) {
    return lines.slice(0, options.rows).join('\n');
  }

  return lines.join('\n');
}

export default renderToString;
