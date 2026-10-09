import { useApp } from './useApp.js';
import type { CursorPosition } from '../types.js';

export function useCursor(position: CursorPosition | null): void {
  const app = useApp();
  if (app.cursorCollector) {
    app.cursorCollector.setCursor(position);
  }
}

export default useCursor;
