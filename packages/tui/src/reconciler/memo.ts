import type { FunctionComponent } from '../types.js';

export function shallowEqual(objA: any, objB: any): boolean {
  if (Object.is(objA, objB)) return true;
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !Object.is(objA[key], objB[key])) {
      return false;
    }
  }

  return true;
}

export function memo<P = any>(
  component: FunctionComponent<P>,
  areEqual?: (previous: Readonly<P>, next: Readonly<P>) => boolean,
): FunctionComponent<P> {
  const memoized: FunctionComponent<P> = (props) => component(props);
  (memoized as any).$$isMemo = true;
  (memoized as any).$$targetComponent = component;
  (memoized as any).$$areEqual = areEqual || shallowEqual;
  return memoized;
}
