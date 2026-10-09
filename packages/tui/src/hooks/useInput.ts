import { useEffect } from './useEffect.js';
import { useRef } from './useRef.js';
import { useApp } from './useApp.js';
import { getCurrentRenderingInstance } from '../reconciler/hookState.js';
import type { InputEvent } from '../terminal/input.js';

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

export default useInput;
