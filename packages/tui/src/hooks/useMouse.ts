import { useEffect } from './useEffect.js';
import { useRef } from './useRef.js';
import { useApp } from './useApp.js';
import type { MouseEvent } from '../terminal/input.js';

export function useMouse(handler: (event: MouseEvent) => boolean | void): void {
  const app = useApp();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!app.engine) return;
    return app.engine.addMouseListener((ev) => handlerRef.current(ev));
  }, [app.engine]);
}

export default useMouse;
