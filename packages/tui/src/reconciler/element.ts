import {
  ELEMENT_TYPE_SYMBOL,
  Fragment,
  type ElementChild,
  type ElementKey,
  type ElementNode,
  type ElementType,
} from '../types.js';

export { ELEMENT_TYPE_SYMBOL, Fragment };

export function isElement(value: unknown): value is ElementNode {
  return (
    value !== null && typeof value === 'object' && (value as any).$$typeof === ELEMENT_TYPE_SYMBOL
  );
}

export function normalizeChildren(children: unknown): readonly ElementChild[] {
  if (children === null || children === undefined || typeof children === 'boolean') {
    return [];
  }
  if (Array.isArray(children)) {
    const result: ElementChild[] = [];
    for (const child of children) {
      if (child === null || child === undefined || typeof child === 'boolean') {
        continue;
      }
      if (Array.isArray(child)) {
        result.push(...normalizeChildren(child));
      } else {
        result.push(child as ElementChild);
      }
    }
    return result;
  }
  return [children as ElementChild];
}

export function jsx<P = any>(
  type: ElementType<P> | string,
  rawProps?: Record<string, unknown> | null,
  keyOverride?: ElementKey,
): ElementNode<P> {
  const { key: propKey, ...restProps } = (rawProps || {}) as Record<string, unknown>;
  const resolvedKey =
    keyOverride !== undefined
      ? keyOverride
      : propKey !== undefined
        ? (propKey as ElementKey)
        : null;

  const rawChildren = (rawProps as any)?.children;
  const normalizedChildren = normalizeChildren(rawChildren);

  const props: any = {
    ...restProps,
    children:
      normalizedChildren.length === 0
        ? undefined
        : normalizedChildren.length === 1
          ? normalizedChildren[0]
          : normalizedChildren,
  };

  return {
    $$typeof: ELEMENT_TYPE_SYMBOL,
    type: type as ElementType<P>,
    key: resolvedKey,
    props,
    children: normalizedChildren,
  };
}

export const jsxs = jsx;
export const jsxDEV = jsx;
