import type { TransformProps, StitchableElement, Block, RenderContext } from './types.js';
import { visibleWidth } from '../text/width.js';

export function renderTransformElement(
  element: StitchableElement<TransformProps>,
  context: RenderContext,
  renderChild: (child: any, ctx: RenderContext) => Block,
): Block {
  const transform = element.props?.transform ?? ((l: string) => l);
  const children = element.props?.children ?? element.children;

  const childBlock = renderChild(children, context);
  const transformedLines = childBlock.lines.map((line, index) => transform(line, index));

  return {
    lines: transformedLines,
    width: Math.max(0, ...transformedLines.map(visibleWidth)),
  };
}

export function Transform(
  props: TransformProps,
  children?: any,
): StitchableElement<TransformProps> {
  const childList = children !== undefined ? (Array.isArray(children) ? children : [children]) : (props.children ? [props.children] : []);
  const el: StitchableElement<TransformProps> = {
    type: Transform,
    props: { ...props, children: childList },
    children: childList,
  };
  return el;
}

export default Transform;
