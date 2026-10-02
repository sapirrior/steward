import { Box } from './elements/Box.js';
import { Text } from './elements/Text.js';
import {
  Fragment,
  type BoxProps,
  type TextProps,
  type StitchableElement,
} from './elements/types.js';
import Component from './engine/Component.js';

export { Fragment };

function flattenChildren(children: any): any[] {
  if (children === null || children === undefined || children === false) {
    return [];
  }
  if (Array.isArray(children)) {
    return children.flatMap(flattenChildren);
  }
  return [children];
}

export function jsx(type: any, props: any = {}, _key?: any): any {
  if (type === Fragment) {
    return flattenChildren(props?.children);
  }

  const { children, ...rest } = props || {};
  const flatChildren = flattenChildren(children);

  if (type === 'box' || type === 'Box' || type === Box) {
    return Box(rest as BoxProps, ...flatChildren);
  }

  if (type === 'text' || type === 'Text' || type === Text) {
    return Text({ ...(rest as TextProps), children: flatChildren });
  }

  if (typeof type === 'function') {
    // Class component
    if (type.prototype && (type.prototype instanceof Component || 'render' in type.prototype)) {
      return new type(props);
    }
    // Function component element descriptor
    return { type, props: { ...rest, children: flatChildren }, children: flatChildren };
  }

  return null;
}

export const jsxs = jsx;
export const jsxDEV = jsx;

export namespace JSX {
  export type Element = StitchableElement | Component<any, any> | any;
  export interface ElementClass extends Component<any, any> {}
  export interface IntrinsicElements {
    box: BoxProps & { children?: any };
    text: TextProps & { children?: any };
  }
}
