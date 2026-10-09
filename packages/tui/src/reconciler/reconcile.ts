import { Fragment, type ElementChild, type ElementKey, type ElementNode } from '../types.js';
import { isElement, normalizeChildren } from './element.js';
import { createInstance, type ComponentInstance, type InstanceTag } from './instance.js';
import { isErrorBoundaryClass, ComponentRenderError } from './errors.js';
import Component from '../engine/Component.js';

import {
  prepareToRenderInstance,
  finishRenderingInstance,
  cleanupInstanceEffects,
} from './hooks.js';
import { pushContextValue, popContextValue } from './context.js';
import { shallowEqual } from './memo.js';

export interface RuntimeContext {
  scheduleUpdate?(instance?: ComponentInstance): void;
  onError?(error: Error): void;
}

export function unmountInstance(instance: ComponentInstance | null): void {
  if (!instance) return;

  cleanupInstanceEffects(instance);

  if (instance.tag === 'class' && instance.classInstance) {
    try {
      if (typeof instance.classInstance.componentWillUnmount === 'function') {
        instance.classInstance.componentWillUnmount();
      }
    } catch (e) {
      console.error('Error during componentWillUnmount:', e);
    }
  }

  if (instance.renderedChild) {
    unmountInstance(instance.renderedChild);
    instance.renderedChild = null;
  }

  for (const child of instance.children) {
    unmountInstance(child);
  }
  instance.children = [];
  instance.isMounted = false;
}

export function unmountTree(root: ComponentInstance | null): void {
  unmountInstance(root);
}

function matchKeyAndType(
  instance: ComponentInstance,
  type: unknown,
  key: ElementKey | null,
): boolean {
  return instance.type === type && instance.key === key;
}

function isHostType(type: unknown): boolean {
  if (typeof type === 'string') {
    const lower = type.toLowerCase();
    return (
      lower === 'box' ||
      lower === 'text' ||
      lower === 'spacer' ||
      lower === 'newline' ||
      lower === 'transform'
    );
  }
  if (typeof type === 'function') {
    const name = type.name;
    return (
      name === 'Box' ||
      name === 'Text' ||
      name === 'Spacer' ||
      name === 'Newline' ||
      name === 'Transform'
    );
  }
  return false;
}

export function reconcileInstance(
  prevInstance: ComponentInstance | null,
  element: ElementChild,
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance | null {
  if (element === null || element === undefined || typeof element === 'boolean') {
    if (prevInstance) {
      unmountInstance(prevInstance);
    }
    return null;
  }

  if (typeof element === 'string' || typeof element === 'number') {
    const textVal = String(element);
    if (prevInstance && prevInstance.tag === 'text') {
      prevInstance.element = textVal;
      prevInstance.props = { text: textVal };
      return prevInstance;
    }
    if (prevInstance) {
      unmountInstance(prevInstance);
    }
    const inst = createInstance('text', null, null, { text: textVal }, textVal, parent);
    inst.isMounted = true;
    return inst;
  }

  if (Array.isArray(element)) {
    const childrenList = normalizeChildren(element);
    return reconcileArrayChildren(prevInstance, childrenList, parent, runtime);
  }

  if (isElement(element)) {
    const { type, key, props, children } = element;

    if (type === Fragment) {
      return reconcileFragment(prevInstance, element, children, parent, runtime);
    }

    if (isHostType(type)) {
      return reconcileHost(prevInstance, element, parent, runtime);
    }

    if (typeof type === 'function') {
      const isClass =
        type.prototype && (type.prototype instanceof Component || 'render' in type.prototype);

      if (isClass) {
        return reconcileClassComponent(prevInstance, element, parent, runtime);
      }
      return reconcileFunctionComponent(prevInstance, element, parent, runtime);
    }

    throw new Error(`Unknown intrinsic element or type: <${String(type)}>`);
  }

  // Fallback for raw objects or legacy descriptors
  if (typeof element === 'object') {
    if (prevInstance) {
      unmountInstance(prevInstance);
    }
    const inst = createInstance('host', null, null, {}, element, parent);
    inst.isMounted = true;
    return inst;
  }

  return null;
}

function reconcileHost(
  prevInstance: ComponentInstance | null,
  element: ElementNode,
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance {
  const { type, key, props, children } = element;
  let inst = prevInstance;

  if (!inst || !matchKeyAndType(inst, type, key)) {
    if (inst) {
      unmountInstance(inst);
    }
    inst = createInstance('host', type, key, props as Record<string, any>, element, parent);
  } else {
    inst.props = props as Record<string, any>;
    inst.element = element;
  }

  const childNodes =
    children && children.length > 0
      ? children
      : (props as any).children !== undefined
        ? Array.isArray((props as any).children)
          ? (props as any).children
          : [(props as any).children]
        : [];

  inst.children = reconcileChildList(inst.children, childNodes, inst, runtime);
  inst.isMounted = true;
  return inst;
}

function reconcileFragment(
  prevInstance: ComponentInstance | null,
  element: ElementNode,
  children: readonly ElementChild[],
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance {
  const { type, key, props } = element;
  let inst = prevInstance;

  if (!inst || !matchKeyAndType(inst, type, key)) {
    if (inst) {
      unmountInstance(inst);
    }
    inst = createInstance('fragment', type, key, props as Record<string, any>, element, parent);
  } else {
    inst.props = props as Record<string, any>;
    inst.element = element;
  }

  inst.children = reconcileChildList(inst.children, children, inst, runtime);
  inst.isMounted = true;
  return inst;
}

function reconcileArrayChildren(
  prevInstance: ComponentInstance | null,
  elements: readonly ElementChild[],
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance {
  let inst = prevInstance;
  if (!inst || inst.tag !== 'fragment') {
    if (inst) {
      unmountInstance(inst);
    }
    inst = createInstance('fragment', Fragment, null, {}, elements, parent);
  }
  inst.children = reconcileChildList(inst.children, elements, inst, runtime);
  inst.isMounted = true;
  return inst;
}

function getComponentName(type: unknown): string {
  if (typeof type === 'function') {
    return type.name || 'Anonymous';
  }
  if (typeof type === 'string') {
    return type;
  }
  if (typeof type === 'symbol') {
    return type.description || 'Symbol';
  }
  return 'Unknown';
}

function reconcileClassComponent(
  prevInstance: ComponentInstance | null,
  element: ElementNode,
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance {
  const { type, key, props } = element;
  let inst = prevInstance;
  const isBoundary = isErrorBoundaryClass(type);

  if (!inst || !matchKeyAndType(inst, type, key) || !inst.classInstance) {
    if (inst) {
      unmountInstance(inst);
    }
    inst = createInstance('class', type, key, props as Record<string, any>, element, parent);
    const ClassType = type as new (props: any) => Component;
    const classInst = new ClassType(props);
    classInst._updater = {
      enqueueSetState(target, partial) {
        target.state = { ...target.state, ...partial };
        target.markDirty();
        if (runtime.scheduleUpdate && inst) {
          runtime.scheduleUpdate(inst);
        }
      },
    };
    inst.classInstance = classInst;
  } else {
    const prevProps = inst.classInstance.props;
    const prevState = inst.classInstance.state;
    inst.prevProps = prevProps;
    inst.prevState = prevState;
    inst.classInstance.props = props;
    inst.props = props as Record<string, any>;
    inst.element = element;
  }

  try {
    const rendered = inst.classInstance.render();
    inst.renderedChild = reconcileInstance(inst.renderedChild, rendered, inst, runtime);

    if (!inst.isMounted) {
      inst.isMounted = true;
      if (typeof inst.classInstance.componentDidMount === 'function') {
        try {
          inst.classInstance.componentDidMount();
        } catch (e) {
          console.error('Error in componentDidMount:', e);
        }
      }
    } else {
      if (typeof inst.classInstance.componentDidUpdate === 'function') {
        try {
          inst.classInstance.componentDidUpdate(inst.prevProps, inst.prevState);
        } catch (e) {
          console.error('Error in componentDidUpdate:', e);
        }
      }
    }
  } catch (err: any) {
    if (isBoundary) {
      const rawError =
        err instanceof ComponentRenderError && err.originalError ? err.originalError : err;
      const boundaryClass = type as any;
      if (typeof boundaryClass.getDerivedStateFromError === 'function') {
        const partial = boundaryClass.getDerivedStateFromError(rawError);
        inst.classInstance.state = { ...inst.classInstance.state, ...partial };
      }
      if (typeof inst.classInstance.componentDidCatch === 'function') {
        inst.classInstance.componentDidCatch(rawError, {
          componentStack: getComponentName(type),
        });
      }
      // Re-render with error state
      const fallbackRendered = inst.classInstance.render();
      inst.renderedChild = reconcileInstance(inst.renderedChild, fallbackRendered, inst, runtime);
    } else {
      throw err instanceof ComponentRenderError
        ? err
        : new ComponentRenderError(getComponentName(type), err);
    }
  }

  return inst;
}

function reconcileFunctionComponent(
  prevInstance: ComponentInstance | null,
  element: ElementNode,
  parent: ComponentInstance | null,
  runtime: RuntimeContext,
): ComponentInstance {
  const { type, key, props } = element;
  let inst = prevInstance;

  if (!inst || !matchKeyAndType(inst, type, key)) {
    if (inst) {
      unmountInstance(inst);
    }
    inst = createInstance('function', type, key, props as Record<string, any>, element, parent);
  } else {
    inst.props = props as Record<string, any>;
    inst.element = element;
  }

  (inst as any)._runtime = runtime;

  // 1. Context Provider special handling
  if ((type as any).$$isProvider) {
    const contextId = (type as any).$$contextId;
    const prevContextVal = pushContextValue(contextId, props.value);
    try {
      inst.renderedChild = reconcileInstance(
        inst.renderedChild,
        (props as any).children,
        inst,
        runtime,
      );
      inst.isMounted = true;
    } finally {
      popContextValue(contextId, prevContextVal);
    }
    return inst;
  }

  // 2. Memoized Component skipping
  if ((type as any).$$isMemo && inst.isMounted && inst.prevProps) {
    const areEqual = (type as any).$$areEqual || shallowEqual;
    if (areEqual(inst.prevProps, props)) {
      inst.element = element;
      inst.props = props as Record<string, any>;
      return inst;
    }
  }

  const targetFunc = (type as any).$$isMemo
    ? (type as any).$$targetComponent
    : (type as (p: any) => ElementChild);

  try {
    prepareToRenderInstance(inst);
    const rendered = targetFunc(props);
    finishRenderingInstance();
    inst.prevProps = props;
    inst.renderedChild = reconcileInstance(inst.renderedChild, rendered, inst, runtime);
    inst.isMounted = true;
  } catch (err: any) {
    finishRenderingInstance();
    throw new ComponentRenderError(getComponentName(type), err);
  }

  return inst;
}

function reconcileChildList(
  prevChildren: ComponentInstance[],
  nextElements: readonly ElementChild[],
  parent: ComponentInstance,
  runtime: RuntimeContext,
): ComponentInstance[] {
  const result: ComponentInstance[] = [];

  // Key map of previous instances
  const keyedPrev = new Map<ElementKey, ComponentInstance>();
  const unkeyedPrev: ComponentInstance[] = [];

  for (const child of prevChildren) {
    if (child.key !== null && child.key !== undefined) {
      keyedPrev.set(child.key, child);
    } else {
      unkeyedPrev.push(child);
    }
  }

  let unkeyedIndex = 0;

  for (let i = 0; i < nextElements.length; i++) {
    const nextElem = nextElements[i];
    if (nextElem === null || nextElem === undefined || typeof nextElem === 'boolean') {
      continue;
    }

    let matchingPrev: ComponentInstance | null = null;
    const elemKey = isElement(nextElem) ? nextElem.key : null;

    if (elemKey !== null && elemKey !== undefined) {
      if (keyedPrev.has(elemKey)) {
        matchingPrev = keyedPrev.get(elemKey)!;
        keyedPrev.delete(elemKey);
      }
    } else if (unkeyedIndex < unkeyedPrev.length) {
      matchingPrev = unkeyedPrev[unkeyedIndex++];
    }

    const reconciled = reconcileInstance(matchingPrev, nextElem, parent, runtime);
    if (reconciled) {
      result.push(reconciled);
    }
  }

  // Unmount any unused previous instances
  for (const remainingKeyed of keyedPrev.values()) {
    unmountInstance(remainingKeyed);
  }
  for (let i = unkeyedIndex; i < unkeyedPrev.length; i++) {
    unmountInstance(unkeyedPrev[i]);
  }

  return result;
}

export function reconcileRoot(
  previousTree: ComponentInstance | null,
  nextElement: ElementChild,
  runtime: RuntimeContext = {},
): ComponentInstance | null {
  return reconcileInstance(previousTree, nextElement, null, runtime);
}
