import type { SpacerProps, StitchableElement, Block, RenderContext } from './types.js';

export function renderSpacerElement(
  _element: StitchableElement<SpacerProps>,
  context: RenderContext,
): Block {
  const width = Math.max(0, context.width);
  return {
    lines: [' '.repeat(width)],
    width,
  };
}

export function Spacer(props?: SpacerProps): StitchableElement<SpacerProps & { flexGrow: number }> {
  const el: StitchableElement<SpacerProps & { flexGrow: number }> = {
    type: Spacer,
    props: { ...props, flexGrow: 1 },
    children: [],
    render(width: number): string[] {
      return renderSpacerElement(el, { width, colorLevel: 3 }).lines;
    },
  };
  return el;
}

export default Spacer;
