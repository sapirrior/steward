import { createContext, useContext } from '../reconciler/context.js';
import { useEffect, useState, useRef, getCurrentRenderingInstance } from '../reconciler/hooks.js';
import type { TerminalEngine } from '../engine/TerminalEngine.js';
import type { TerminalIO } from '../terminal/io.js';
import type { InputEvent } from '../terminal/input.js';
import type { InputDispatcher } from './InputDispatcher.js';

export interface CursorPosition {
  line: number;
  characterOffset: number;
}

export interface TerminalSize {
  columns: number;
  rows: number;
}

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
