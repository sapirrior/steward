import { getWorkInProgressHook, type MutableRef } from '../reconciler/hookState.js';

export type { MutableRef };

export function useRef<T>(initialValue: T): MutableRef<T> {
  const { slot, isNew, instance } = getWorkInProgressHook('ref');

  if (isNew) {
    const refObject: MutableRef<T> = { current: initialValue };
    instance.hookSlots.push({ kind: 'ref', ref: refObject });
    return refObject;
  }

  return (slot as { kind: 'ref'; ref: MutableRef<T> }).ref;
}

export default useRef;
