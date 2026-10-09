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

export function getCurrentRenderingInstance(): ComponentInstance | null {
  return currentInstance;
}

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

export function getWorkInProgressHook(expectedKind: string): {
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

export function registerEffect(
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
