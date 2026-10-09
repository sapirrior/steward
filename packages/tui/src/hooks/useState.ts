import {
  getWorkInProgressHook,
  getCurrentRenderingInstance,
  type StateAction,
} from '../reconciler/hookState.js';

export type { StateAction };

export function useState<S>(initial: S | (() => S)): [S, (action: StateAction<S>) => void] {
  const { slot, isNew, instance } = getWorkInProgressHook('state');

  if (isNew) {
    const resolvedInitial = typeof initial === 'function' ? (initial as () => S)() : initial;
    const newSlot = { kind: 'state' as const, state: resolvedInitial };
    instance.hookSlots.push(newSlot);

    const setter = (action: StateAction<S>) => {
      if (getCurrentRenderingInstance() === instance) {
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
    if (getCurrentRenderingInstance() === instance) {
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

export default useState;
