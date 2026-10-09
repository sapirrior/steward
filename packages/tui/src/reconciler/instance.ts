import type { ElementChild, ElementKey, ElementType } from '../types.js';
import type Component from '../engine/Component.js';

export type InstanceTag = 'host' | 'function' | 'class' | 'fragment' | 'text' | 'empty';

export interface ComponentInstance {
  tag: InstanceTag;
  type: ElementType | null;
  key: ElementKey | null;
  props: Record<string, any>;
  element: ElementChild;
  classInstance: Component | null;
  children: ComponentInstance[];
  renderedChild: ComponentInstance | null;
  parent: ComponentInstance | null;
  hookSlots: any[];
  isMounted: boolean;
  prevProps?: any;
  prevState?: any;
  errorState?: any;
}

export function createInstance(
  tag: InstanceTag,
  type: ElementType | null,
  key: ElementKey | null,
  props: Record<string, any>,
  element: ElementChild,
  parent: ComponentInstance | null,
): ComponentInstance {
  return {
    tag,
    type,
    key,
    props,
    element,
    classInstance: null,
    children: [],
    renderedChild: null,
    parent,
    hookSlots: [],
    isMounted: false,
  };
}
