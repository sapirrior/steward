import { jsx, jsxs, jsxDEV, Fragment } from './reconciler/element.js';
import type { ElementNode } from './types.js';
import type { BoxProps, TextProps, StitchableElement } from './elements/types.js';
import type Component from './engine/Component.js';

export { jsx, jsxs, jsxDEV, Fragment };

export namespace JSX {
  export type Element = ElementNode | StitchableElement | Component<any, any> | any;
  export interface ElementClass extends Component<any, any> {}
  export interface IntrinsicAttributes {
    key?: string | number | null;
  }
  export interface IntrinsicElements {
    box: BoxProps & { children?: any };
    text: TextProps & { children?: any };
  }
}
