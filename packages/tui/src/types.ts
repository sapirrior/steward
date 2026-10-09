import type { ColorLevel } from './terminal/color.js';
import type Component from './engine/Component.js';

export const ELEMENT_TYPE_SYMBOL: unique symbol = Symbol.for('stitchable.element');
export const Fragment: unique symbol = Symbol.for('stitchable.fragment');

export type ElementKey = string | number;

export type ElementChild =
  ElementNode | string | number | boolean | null | undefined | readonly ElementChild[];

export type IntrinsicType = 'box' | 'text';

export type FunctionComponent<P = any> = (props: P & { children?: ElementChild }) => ElementChild;

export type ClassComponentType<P = any> = new (props: P) => Component<P & Record<string, any>, any>;

export type ElementType<P = any> =
  IntrinsicType | FunctionComponent<P> | ClassComponentType<P> | typeof Fragment;

export type ComponentOutput = ElementChild;

export interface ElementNode<P = any> {
  readonly $$typeof: symbol;
  readonly type: ElementType<P>;
  readonly key: ElementKey | null;
  readonly props: Readonly<P & { children?: ElementChild }>;
  readonly children: readonly ElementChild[];
}
