import type { ComponentInstance } from './instance.js';

export type DependencyList = readonly unknown[];
export type StateAction<S> = S | ((previous: S) => S);
export type Reducer<S, A> = (state: S, action: A) => S;
export interface MutableRef<T> {
  current: T;
}

export type HookSlot =
  | { kind: 'state'; state: any }
  | { kind: 'reducer'; state: any; reducer: Reducer<any, any> }
  | { kind: 'ref'; ref: MutableRef<any> }
  | { kind: 'memo'; value: any; deps: DependencyList }
  | { kind: 'callback'; callback: any; deps: DependencyList }
  | {
      kind: 'effect';
      deps?: DependencyList;
      destroy?: () => void;
      create?: () => void | (() => void);
      isLayout: boolean;
    };

let currentInstance: ComponentInstance | null = null;
let currentHookIndex = 0;
let isRendering = false;

export interface EffectRecord {
  instance: ComponentInstance;
  create: () => void | (() => void);
  destroy?: () => void;
  isLayout: boolean;
  hookIndex: number;
}

let pendingEffects: EffectRecord[] = [];

export function getPendingEffects(): EffectRecord[] {
  const effects = pendingEffects;
  pendingEffects = [];
  return effects;
}

export function areDepsEqual(prev?: DependencyList, next?: DependencyList): boolean {
  if (!prev || !next) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) {
      return false;
    }
  }
  return true;
}

export function prepareToRenderInstance(instance: ComponentInstance): void {
  currentInstance = instance;
  currentHookIndex = 0;
  isRendering = true;
}

export function finishRenderingInstance(): void {
  if (currentInstance) {
    if (currentInstance.isMounted && currentHookIndex < currentInstance.hookSlots.length) {
      throw new Error(
        `Rendered fewer hooks than expected. Previous: ${currentInstance.hookSlots.length}, Current: ${currentHookIndex}.`,
      );
    }
  }
  currentInstance = null;
  currentHookIndex = 0;
  isRendering = false;
}

function getWorkInProgressHook(expectedKind: string): {
  slot: HookSlot;
  isNew: boolean;
  instance: ComponentInstance;
  index: number;
} {
  if (!currentInstance || !isRendering) {
    throw new Error(
      `Invalid hook call. Hooks can only be called inside the body of a function component.`,
    );
  }

  const inst = currentInstance;
  const index = currentHookIndex++;
  const slots = inst.hookSlots;

  if (index < slots.length) {
    const existing = slots[index];
    if (existing.kind !== expectedKind) {
      throw new Error(
        `Hook kind mismatch at slot ${index}. Expected '${existing.kind}', received '${expectedKind}'.`,
      );
    }
    return { slot: existing, isNew: false, instance: inst, index };
  }

  return { slot: null as any, isNew: true, instance: inst, index };
}

export function useState<S>(initial: S | (() => S)): [S, (action: StateAction<S>) => void] {
  const { slot, isNew, instance } = getWorkInProgressHook('state');

  if (isNew) {
    const resolvedInitial = typeof initial === 'function' ? (initial as () => S)() : initial;
    const newSlot: HookSlot = { kind: 'state', state: resolvedInitial };
    instance.hookSlots.push(newSlot);

    const setter = (action: StateAction<S>) => {
      if (isRendering && currentInstance === instance) {
        throw new Error(`Cannot update component state while rendering.`);
      }
      const prevState = newSlot.state;
      const nextState =
        typeof action === 'function' ? (action as (prev: S) => S)(prevState) : action;

      if (!Object.is(prevState, nextState)) {
        newSlot.state = nextState;
        if ((instance as any)._runtime?.scheduleUpdate) {
          (instance as any)._runtime.scheduleUpdate(instance);
        }
      }
    };

    return [resolvedInitial, setter];
  }

  const stateSlot = slot as { kind: 'state'; state: S };
  const setter = (action: StateAction<S>) => {
    if (isRendering && currentInstance === instance) {
      throw new Error(`Cannot update component state while rendering.`);
    }
    const prevState = stateSlot.state;
    const nextState = typeof action === 'function' ? (action as (prev: S) => S)(prevState) : action;

    if (!Object.is(prevState, nextState)) {
      stateSlot.state = nextState;
      if ((instance as any)._runtime?.scheduleUpdate) {
        (instance as any)._runtime.scheduleUpdate(instance);
      }
    }
  };

  return [stateSlot.state, setter];
}

export function useReducer<S, A, I>(
  reducer: Reducer<S, A>,
  initialArg: I,
  init: (arg: I) => S,
): [S, (action: A) => void];
export function useReducer<S, A>(reducer: Reducer<S, A>, initialState: S): [S, (action: A) => void];
export function useReducer<S, A, I>(
  reducer: Reducer<S, A>,
  initialArg: I | S,
  init?: (arg: I) => S,
): [S, (action: A) => void] {
  const { slot, isNew, instance } = getWorkInProgressHook('reducer');

  if (isNew) {
    const initialState = init !== undefined ? init(initialArg as I) : (initialArg as S);
    const newSlot: HookSlot = {
      kind: 'reducer',
      state: initialState,
      reducer,
    };
    instance.hookSlots.push(newSlot);

    const dispatch = (action: A) => {
      if (isRendering && currentInstance === instance) {
        throw new Error(`Cannot update component reducer while rendering.`);
      }
      const prevState = newSlot.state;
      const nextState = newSlot.reducer(prevState, action);
      if (!Object.is(prevState, nextState)) {
        newSlot.state = nextState;
        if ((instance as any)._runtime?.scheduleUpdate) {
          (instance as any)._runtime.scheduleUpdate(instance);
        }
      }
    };

    return [initialState, dispatch];
  }

  const redSlot = slot as { kind: 'reducer'; state: S; reducer: Reducer<S, A> };
  redSlot.reducer = reducer;

  const dispatch = (action: A) => {
    if (isRendering && currentInstance === instance) {
      throw new Error(`Cannot update component reducer while rendering.`);
    }
    const prevState = redSlot.state;
    const nextState = redSlot.reducer(prevState, action);
    if (!Object.is(prevState, nextState)) {
      redSlot.state = nextState;
      if ((instance as any)._runtime?.scheduleUpdate) {
        (instance as any)._runtime.scheduleUpdate(instance);
      }
    }
  };

  return [redSlot.state, dispatch];
}

export function useRef<T>(initialValue: T): MutableRef<T> {
  const { slot, isNew, instance } = getWorkInProgressHook('ref');

  if (isNew) {
    const refObject: MutableRef<T> = { current: initialValue };
    instance.hookSlots.push({ kind: 'ref', ref: refObject });
    return refObject;
  }

  return (slot as { kind: 'ref'; ref: MutableRef<T> }).ref;
}

export function useMemo<T>(factory: () => T, deps: DependencyList): T {
  const { slot, isNew, instance } = getWorkInProgressHook('memo');

  if (isNew) {
    const value = factory();
    instance.hookSlots.push({ kind: 'memo', value, deps });
    return value;
  }

  const memoSlot = slot as { kind: 'memo'; value: T; deps: DependencyList };
  if (areDepsEqual(memoSlot.deps, deps)) {
    return memoSlot.value;
  }

  const newValue = factory();
  memoSlot.value = newValue;
  memoSlot.deps = deps;
  return newValue;
}

export function useCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: DependencyList,
): T {
  const { slot, isNew, instance } = getWorkInProgressHook('callback');

  if (isNew) {
    instance.hookSlots.push({ kind: 'callback', callback, deps });
    return callback;
  }

  const cbSlot = slot as { kind: 'callback'; callback: T; deps: DependencyList };
  if (areDepsEqual(cbSlot.deps, deps)) {
    return cbSlot.callback;
  }

  cbSlot.callback = callback;
  cbSlot.deps = deps;
  return callback;
}

function registerEffect(
  effect: () => void | (() => void),
  deps: DependencyList | undefined,
  isLayout: boolean,
): void {
  const { slot, isNew, instance, index } = getWorkInProgressHook('effect');

  if (isNew) {
    const effectSlot: HookSlot = {
      kind: 'effect',
      deps,
      isLayout,
    };
    instance.hookSlots.push(effectSlot);
    pendingEffects.push({
      instance,
      create: effect,
      isLayout,
      hookIndex: index,
    });
    return;
  }

  const effSlot = slot as {
    kind: 'effect';
    deps?: DependencyList;
    destroy?: () => void;
    isLayout: boolean;
  };

  if (!effSlot.deps || !deps || !areDepsEqual(effSlot.deps, deps)) {
    effSlot.deps = deps;
    pendingEffects.push({
      instance,
      create: effect,
      destroy: effSlot.destroy,
      isLayout,
      hookIndex: index,
    });
  }
}

export function useEffect(effect: () => void | (() => void), deps?: DependencyList): void {
  registerEffect(effect, deps, false);
}

export function useLayoutEffect(effect: () => void | (() => void), deps?: DependencyList): void {
  registerEffect(effect, deps, true);
}

export function cleanupInstanceEffects(instance: ComponentInstance): void {
  for (const slot of instance.hookSlots) {
    if (slot.kind === 'effect' && typeof slot.destroy === 'function') {
      try {
        slot.destroy();
      } catch (e) {
        console.error('Error during effect cleanup:', e);
      }
      slot.destroy = undefined;
    }
  }
}
