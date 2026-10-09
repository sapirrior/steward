import { createContext, useContext } from '../reconciler/context.js';
import type { TerminalEngine } from '../engine/TerminalEngine.js';
import type { TerminalIO } from '../terminal/io.js';
import type { InputDispatcher } from './InputDispatcher.js';
import type { CursorPosition } from '../types.js';

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

export function useAppContext(): AppContextValue {
  return useContext(AppContext);
}
