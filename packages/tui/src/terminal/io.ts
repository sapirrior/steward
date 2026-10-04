import { StringDecoder } from 'node:string_decoder';

export interface TerminalIO {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;
  readonly colorLevel: 0 | 1 | 2 | 3;
  write(data: string): void;
  onResize(cb: () => void): () => void;
  input: {
    setRaw(on: boolean): void;
    resume(): void;
    pause(): void;
    onData(cb: (chunk: string) => void): () => void;
  };
}

/**
 * Detects terminal color support level from environment:
 * 0: No color
 * 1: 16 colors (basic ANSI)
 * 2: 256 colors
 * 3: Truecolor (16m / 24-bit)
 */
function detectColorLevel(isTTY: boolean): 0 | 1 | 2 | 3 {
  if (process.env.NO_COLOR !== undefined) return 0;
  if (process.env.FORCE_COLOR !== undefined) {
    const force = process.env.FORCE_COLOR;
    if (force === '0' || force === 'false') return 0;
    if (force === '1') return 1;
    if (force === '2') return 2;
    if (force === '3' || force === 'true') return 3;
    return 1;
  }
  if (!isTTY) return 0;
  const colorTerm = process.env.COLORTERM?.toLowerCase();
  if (colorTerm === 'truecolor' || colorTerm === '24bit') return 3;
  const term = process.env.TERM?.toLowerCase() || '';
  if (term.includes('256color')) return 2;
  return 1;
}

export function nodeIO(opts?: {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
}): TerminalIO {
  const stdout = opts?.stdout ?? process.stdout;
  const stdin = opts?.stdin ?? process.stdin;
  const isTTY = Boolean(stdout.isTTY);
  const colorLevel = detectColorLevel(isTTY);

  return {
    get columns(): number {
      return stdout.columns || 80;
    },
    get rows(): number {
      return stdout.rows || 24;
    },
    isTTY,
    colorLevel,
    write(data: string): void {
      stdout.write(data);
    },
    onResize(cb: () => void): () => void {
      stdout.on('resize', cb);
      return () => {
        stdout.off('resize', cb);
      };
    },
    input: {
      setRaw(on: boolean): void {
        if ('setRawMode' in stdin && typeof stdin.setRawMode === 'function') {
          try {
            stdin.setRawMode(on);
          } catch {}
        }
      },
      resume(): void {
        stdin.resume();
      },
      pause(): void {
        try {
          stdin.pause();
        } catch {}
        if ('unref' in stdin && typeof (stdin as any).unref === 'function') {
          try {
            (stdin as any).unref();
          } catch {}
        }
      },
      onData(cb: (chunk: string) => void): () => void {
        const decoder = new StringDecoder('utf8');
        const handler = (chunk: Buffer | string) => {
          const str = typeof chunk === 'string' ? chunk : decoder.write(chunk);
          if (str.length > 0) {
            cb(str);
          }
        };
        stdin.on('data', handler);
        return () => {
          stdin.off('data', handler);
        };
      },
    },
  };
}

export interface MemoryIO extends TerminalIO {
  output: string[];
  readonly written: string;
  feed(chunk: string): void;
  resize(cols: number, rows: number): void;
  clearOutput(): void;
}

export function memoryIO(opts: {
  columns: number;
  rows: number;
  colorLevel?: 0 | 1 | 2 | 3;
}): MemoryIO {
  let cols = opts.columns;
  let rows = opts.rows;
  const colorLevel = opts.colorLevel ?? 0;
  const output: string[] = [];
  const resizeListeners = new Set<() => void>();
  const dataListeners = new Set<(chunk: string) => void>();

  return {
    get columns(): number {
      return cols;
    },
    get rows(): number {
      return rows;
    },
    isTTY: true,
    colorLevel,
    output,
    get written(): string {
      return output.join('');
    },
    write(data: string): void {
      output.push(data);
    },
    onResize(cb: () => void): () => void {
      resizeListeners.add(cb);
      return () => {
        resizeListeners.delete(cb);
      };
    },
    input: {
      setRaw(_on: boolean): void {},
      resume(): void {},
      pause(): void {},
      onData(cb: (chunk: string) => void): () => void {
        dataListeners.add(cb);
        return () => {
          dataListeners.delete(cb);
        };
      },
    },
    feed(chunk: string): void {
      for (const listener of dataListeners) {
        listener(chunk);
      }
    },
    resize(newCols: number, newRows: number): void {
      cols = newCols;
      rows = newRows;
      for (const listener of resizeListeners) {
        listener();
      }
    },
    clearOutput(): void {
      output.length = 0;
    },
  };
}
