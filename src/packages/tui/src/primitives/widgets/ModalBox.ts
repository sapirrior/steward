import { figures } from '../../theme/index.js';
import { c, italic } from '../../theme/style.js';
import { Box, BoxElement } from '../Box.js';
import { Text, TextElement } from '../Text.js';

export interface ModalBoxOptions {
  title: string;
  subtitle?: string;
  queryInput?: { query: string; placeholder: string };
  content: (BoxElement | TextElement | string)[];
  footer?: string;
  width?: number;
}

export function renderModalBox(options: ModalBoxOptions): string[] {
  const termWidth = options.width ?? process.stdout.columns ?? 80;
  const maxCols = Math.max(1, termWidth);
  const dividerWidth = Math.max(1, termWidth);

  const elements: (BoxElement | TextElement | string)[] = [];

  // Top rule
  elements.push(Text(c.rule(figures.horizontalLine.repeat(dividerWidth)), { clip: true }));

  // Header Title Row
  if (options.subtitle) {
    elements.push(
      Box({ direction: 'row', justify: 'space-between', width: maxCols }, [
        Text(options.title, { color: 'info' }),
        Text(options.subtitle, { color: 'muted' }),
      ]),
    );
  } else {
    elements.push(Text(options.title, { color: 'permission' }));
  }

  // Search Query input
  if (options.queryInput) {
    const pointer = c.info(`${figures.pointer} `);
    const queryDisplay = options.queryInput.query
      ? c.text(options.queryInput.query)
      : c.muted(options.queryInput.placeholder);
    elements.push(Text(`${pointer}${queryDisplay}`));
    elements.push(Text(c.rule(figures.horizontalLine.repeat(dividerWidth)), { clip: true }));
  }

  // Content children
  for (const child of options.content) {
    elements.push(child);
  }

  // Footer
  if (options.footer) {
    elements.push(Text(italic(c.muted(options.footer))));
  }

  const modalBox = Box({ direction: 'column', width: maxCols, clip: true }, elements);
  return modalBox.render(maxCols);
}
