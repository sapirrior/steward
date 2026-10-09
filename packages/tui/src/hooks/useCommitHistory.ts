import { useLayoutEffect } from './useLayoutEffect.js';
import { useRef } from './useRef.js';
import { useState } from './useState.js';
import { useApp } from './useApp.js';
import { areDepsEqual, type DependencyList } from '../reconciler/hookState.js';
import { renderStatic } from '../reconciler/static-render.js';
import type { ElementChild, CommitHistoryOptions } from '../types.js';

export function useCommitHistory(
  element: ElementChild,
  deps: DependencyList,
  options?: CommitHistoryOptions,
): { readonly committed: boolean } {
  if (!deps || !Array.isArray(deps)) {
    throw new Error('useCommitHistory requires a dependency array');
  }

  const app = useApp();
  const enabled = options?.enabled ?? true;
  const lastCommittedDepsRef = useRef<DependencyList | null>(null);
  const [, setTick] = useState<number>(0);

  const isCommitted = Boolean(
    enabled &&
      lastCommittedDepsRef.current !== null &&
      areDepsEqual(lastCommittedDepsRef.current, deps),
  );

  useLayoutEffect(() => {
    if (!enabled) return;
    if (lastCommittedDepsRef.current && areDepsEqual(lastCommittedDepsRef.current, deps)) {
      return;
    }

    const capturedElement = element;
    const opts = {
      tag: options?.tag,
      wrap: options?.wrap,
      clip: options?.clip,
      hangingIndent: options?.hangingIndent,
    };

    if (app && app.engine) {
      app.engine.batch(() => {
        app.engine.commit((width: number) => {
          return renderStatic(capturedElement, {
            width,
            colorLevel: app.io ? app.io.colorLevel : 3,
          });
        }, opts);
        lastCommittedDepsRef.current = deps;
        setTick((t) => t + 1);
      });
    }
  }, [enabled, ...deps]);

  return { committed: isCommitted };
}

export default useCommitHistory;
