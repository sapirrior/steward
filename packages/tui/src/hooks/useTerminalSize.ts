import { useEffect } from './useEffect.js';
import { useState } from './useState.js';
import { useApp } from './useApp.js';
import type { TerminalSize } from '../types.js';

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

export default useTerminalSize;
