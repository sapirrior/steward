import { createContext, useContext } from '../reconciler/context.js';
import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  getCurrentRenderingInstance,
} from '../reconciler/hooks.js';
import { renderStatic } from '../reconciler/static-render.js';
import type { TerminalEngine } from '../engine/TerminalEngine.js';
import type { TerminalIO } from '../terminal/io.js';
import type { InputEvent } from '../terminal/input.js';
import type { InputDispatcher } from './InputDispatcher.js';
import type {
  ElementChild,
  DependencyList,
  CommitHistoryOptions,
  CursorPosition,
  TerminalSize,
} from '../types.js';

export type { CursorPosition, TerminalSize, CommitHistoryOptions };


export interface AppContextValue {
  readonly engine: TerminalEngine;
  readonly io: TerminalIO;
  exit(errorOrValue?: unknown): void;
  invalidate(): void;
  readonly inputDispatcher?: InputDispatcher;
  readonly cursorCollector?: { setCursor(pos: CursorPosition | null): void };
}

export const AppContext = createContext<AppContextValue>({
  engine: null as any,
  io: null as any,
  exit() {},
  invalidate() {},
});

export function useApp(): AppContextValue {
  return useContext(AppContext);
}

export function useTerminalSize(): TerminalSize {
  const app = useApp();
  const [size, setSize] = useState<TerminalSize>(() => ({
    columns: app.io ? app.io.columns : 80,
    rows: app.io ? app.io.rows : 24,
  }));

  useEffect(() => {
    if (!app.io) return;
    return app.io.onResize(() => {
      setSize({
        columns: app.io.columns,
        rows: app.io.rows,
      });
    });
  }, [app.io]);

  return size;
}

export function useCursor(position: CursorPosition | null): void {
  const app = useApp();
  if (app.cursorCollector) {
    app.cursorCollector.setCursor(position);
  }
}

export function useFocus(options: { id?: string; autoFocus?: boolean } = {}): {
  readonly id: string;
  readonly isFocused: boolean;
  focus(): void;
  blur(): void;
} {
  const app = useApp();
  const idRef = useRef<string | null>(null);
  if (!idRef.current) {
    idRef.current = options.id || `focus-${Math.random().toString(36).slice(2, 9)}`;
  }
  const id = idRef.current;

  const renderingInst = getCurrentRenderingInstance();
  if (renderingInst) {
    (renderingInst as any)._focusId = id;
  }

  const [isFocused, setIsFocused] = useState<boolean>(() => {
    if (app.inputDispatcher) {
      if (options.autoFocus && app.inputDispatcher.getFocus() === null) {
        app.inputDispatcher.setFocus(id);
        return true;
      }
      return app.inputDispatcher.getFocus() === id;
    }
    return false;
  });

  useEffect(() => {
    if (!app.inputDispatcher) return;
    const dispatcher = app.inputDispatcher;

    if (options.autoFocus && dispatcher.getFocus() === null) {
      dispatcher.setFocus(id);
    }

    return dispatcher.onFocusChange((activeId) => {
      setIsFocused(activeId === id);
    });
  }, [app.inputDispatcher, id, options.autoFocus]);

  const focus = () => {
    if (app.inputDispatcher) {
      app.inputDispatcher.setFocus(id);
    }
  };

  const blur = () => {
    if (app.inputDispatcher && app.inputDispatcher.getFocus() === id) {
      app.inputDispatcher.setFocus(null);
    }
  };

  return { id, isFocused, focus, blur };
}

export function useInput(
  handler: (event: InputEvent) => boolean | void,
  options: { whenFocused?: boolean } = {},
): void {
  const app = useApp();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const renderingInst = getCurrentRenderingInstance();
  const boundFocusId = useRef<string | undefined>(
    renderingInst ? (renderingInst as any)._focusId : undefined,
  );
  if (renderingInst && (renderingInst as any)._focusId) {
    boundFocusId.current = (renderingInst as any)._focusId;
  }

  useEffect(() => {
    if (!app.inputDispatcher) return;

    return app.inputDispatcher.register({
      handler: (ev) => handlerRef.current(ev),
      whenFocused: options.whenFocused,
      isFocused: () => {
        if (!app.inputDispatcher) return false;
        const currentFocus = app.inputDispatcher.getFocus();
        if (boundFocusId.current !== undefined) {
          return currentFocus === boundFocusId.current;
        }
        return currentFocus !== null;
      },
    });
  }, [app.inputDispatcher, options.whenFocused]);
}

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

  const areDepsEqual = (a: DependencyList | null, b: DependencyList): boolean => {
    if (!a || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) return false;
    }
    return true;
  };

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

