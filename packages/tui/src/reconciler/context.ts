import type { ElementChild, FunctionComponent } from '../types.js';
import { jsx } from './element.js';
import type { ComponentInstance } from './instance.js';

export const CONTEXT_PROVIDER_TYPE: unique symbol = Symbol.for('stitchable.context_provider');

export interface Context<T> {
  readonly _id: symbol;
  readonly defaultValue: T;
  readonly Provider: FunctionComponent<{ value: T; children?: ElementChild }>;
}

const activeContextMap = new Map<symbol, any>();
let currentInstanceReadingContext: ComponentInstance | null = null;

export function getActiveContextValue<T>(context: Context<T>): T {
  if (activeContextMap.has(context._id)) {
    return activeContextMap.get(context._id);
  }
  return context.defaultValue;
}

export function pushContextValue(contextId: symbol, value: any): any {
  const prev = activeContextMap.get(contextId);
  activeContextMap.set(contextId, value);
  return prev;
}

export function popContextValue(contextId: symbol, prevValue: any): void {
  if (prevValue === undefined) {
    activeContextMap.delete(contextId);
  } else {
    activeContextMap.set(contextId, prevValue);
  }
}

export function createContext<T>(defaultValue: T): Context<T> {
  const contextId = Symbol('stitchable.context');

  const Provider: FunctionComponent<{ value: T; children?: ElementChild }> = (props) => {
    return props.children as ElementChild;
  };

  (Provider as any).$$contextId = contextId;
  (Provider as any).$$isProvider = true;

  const context: Context<T> = {
    _id: contextId,
    defaultValue,
    Provider,
  };

  return context;
}

export function useContext<T>(context: Context<T>): T {
  return getActiveContextValue(context);
}
