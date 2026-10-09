import type { ElementChild, ElementNode } from '../types.js';
import type { ColorLevel } from '../terminal/color.js';
import { renderAnyElement } from '../elements/Box.js';
import { isElement } from './element.js';
import Component from '../engine/Component.js';

export interface RenderStaticOptions {
  width: number;
  colorLevel?: ColorLevel;
}

/**
 * Validates that an element tree contains no class components or invalid static constructs,
 * and recursively resolves pure function components into primitive elements without creating
 * hook instances or state.
 */
function resolveStaticTree(node: any): any {
  if (
    node === null ||
    node === undefined ||
    typeof node === 'boolean' ||
    typeof node === 'string' ||
    typeof node === 'number'
  ) {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map(resolveStaticTree);
  }

  if (typeof node === 'object' && ('type' in node || isElement(node))) {
    const type = node.type;

    // Reject class components
    if (
      typeof type === 'function' &&
      (type.prototype instanceof Component ||
        (type.prototype &&
          'render' in type.prototype &&
          typeof type.prototype.render === 'function'))
    ) {
      throw new Error(
        `Class components cannot be rendered in static history: <${type.name || 'Component'}>`,
      );
    }

    // Pure function components
    if (typeof type === 'function') {
      const typeName = type.name;
      // Built-in intrinsic functional wrappers (Text, Box, Spacer, Newline, Transform)
      if (
        typeName === 'Text' ||
        typeName === 'Box' ||
        typeName === 'Spacer' ||
        typeName === 'Newline' ||
        typeName === 'Transform'
      ) {
        return {
          ...node,
          props: {
            ...node.props,
            children: resolveStaticTree(node.props?.children),
          },
          children: node.children ? node.children.map(resolveStaticTree) : [],
        };
      }

      // User function component: evaluate statically with props.
      // If the component calls any hook, the hook dispatcher will throw because currentInstance is null.
      const childTree = type(node.props || {});
      return resolveStaticTree(childTree);
    }

    // Intrinsic elements or Fragment
    return {
      ...node,
      props: {
        ...node.props,
        children: resolveStaticTree(node.props?.children),
      },
      children: node.children ? node.children.map(resolveStaticTree) : [],
    };
  }

  return node;
}

/**
 * Renders an element snapshot statically for history without creating component instances or hook slots.
 */
export function renderStatic(element: ElementChild, options: RenderStaticOptions): string[] {
  const resolved = resolveStaticTree(element);
  const context = {
    width: options.width,
    colorLevel: options.colorLevel ?? 3,
  };
  const block = renderAnyElement(resolved, context);
  return block.lines;
}

export default renderStatic;
