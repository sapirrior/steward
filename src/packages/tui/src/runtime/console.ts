import type { TerminalEngine } from '../engine/TerminalEngine.js';

let originalConsole: {
  log: typeof console.log;
  info: typeof console.info;
  warn: typeof console.warn;
  error: typeof console.error;
  debug: typeof console.debug;
} | null = null;

export function patchConsole(engine: TerminalEngine): () => void {
  if (originalConsole) return restoreConsole;

  originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  const formatArgs = (...args: any[]): string[] => {
    return args
      .map((a) => (typeof a === 'string' ? a : typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
      .join(' ')
      .split('\n');
  };

  console.log = (...args: any[]) => {
    engine.commit(formatArgs(...args), { tag: 'console' });
  };
  console.info = (...args: any[]) => {
    engine.commit(formatArgs(...args), { tag: 'console' });
  };
  console.warn = (...args: any[]) => {
    engine.commit(formatArgs(...args), { tag: 'console' });
  };
  console.error = (...args: any[]) => {
    engine.commit(formatArgs(...args), { tag: 'console' });
  };
  console.debug = (...args: any[]) => {
    engine.commit(formatArgs(...args), { tag: 'console' });
  };

  return restoreConsole;
}

export function restoreConsole(): void {
  if (!originalConsole) return;
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
  originalConsole = null;
}
