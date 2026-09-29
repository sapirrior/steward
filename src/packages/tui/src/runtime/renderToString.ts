import { renderElement } from '../elements/index.js';
import { beginFrame, endFrame, runPendingEffects } from './hooks.js';

export function renderToString(
  tree: any,
  options?: { columns?: number; rows?: number },
): string {
  const width = options?.columns ?? 80;
  beginFrame();
  let lines: string[] = [];
  try {
    lines = renderElement(tree, { width, colorLevel: 3 });
  } finally {
    endFrame();
    runPendingEffects();
  }
  return lines.join('\n');
}

export default renderToString;
