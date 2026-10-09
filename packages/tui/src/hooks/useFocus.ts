import { useEffect } from './useEffect.js';
import { useState } from './useState.js';
import { useRef } from './useRef.js';
import { useApp } from './useApp.js';
import { getCurrentRenderingInstance } from '../reconciler/hookState.js';

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

export default useFocus;
