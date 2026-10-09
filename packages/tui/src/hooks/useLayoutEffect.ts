import { registerEffect, type DependencyList } from '../reconciler/hookState.js';

export function useLayoutEffect(effect: () => void | (() => void), deps?: DependencyList): void {
  registerEffect(effect, deps, true);
}

export default useLayoutEffect;
