import {
  getWorkInProgressHook,
  areDepsEqual,
  type DependencyList,
} from '../reconciler/hookState.js';

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

export default useCallback;
