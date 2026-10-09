import {
  getWorkInProgressHook,
  areDepsEqual,
  type DependencyList,
} from '../reconciler/hookState.js';

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

export default useMemo;
