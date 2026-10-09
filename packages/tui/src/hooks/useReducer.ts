import {
  getWorkInProgressHook,
  getCurrentRenderingInstance,
  type Reducer,
} from '../reconciler/hookState.js';

export type { Reducer };

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
    const newSlot = {
      kind: 'reducer' as const,
      state: initialState,
      reducer,
    };
    instance.hookSlots.push(newSlot);

    const dispatch = (action: A) => {
      if (getCurrentRenderingInstance() === instance) {
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
    if (getCurrentRenderingInstance() === instance) {
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

export default useReducer;
