import { registerEffect, type DependencyList } from '../reconciler/hookState.js';

export function useEffect(effect: () => void | (() => void), deps?: DependencyList): void {
  registerEffect(effect, deps, false);
}

export default useEffect;
