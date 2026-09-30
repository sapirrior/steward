import type { NewlineProps, StitchableElement, Block, RenderContext } from './types.js';

export function renderNewlineElement(
  element: StitchableElement<NewlineProps>,
  _context: RenderContext,
): Block {
  const count = element.props?.count ?? 1;
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push('');
  }
  return {
    lines,
    width: 0,
  };
}

export function Newline(props?: NewlineProps): StitchableElement<NewlineProps> {
  const el: StitchableElement<NewlineProps> = {
    type: Newline,
    props: props ?? {},
    children: [],
    render(_width: number): string[] {
      return renderNewlineElement(el, { width: _width, colorLevel: 3 }).lines;
    },
  };
  return el;
}

export default Newline;
