import TerminalEngine, { TerminalEngineOptions } from '../../src/engine/TerminalEngine.js';
import { memoryIO, MemoryIO } from '../../src/terminal/io.js';

export interface TestEngineOptions extends Partial<TerminalEngineOptions> {
  columns?: number;
  rows?: number;
}

export function makeEngine(opts: TestEngineOptions = {}): {
  engine: TerminalEngine;
  io: MemoryIO;
} {
  const io = memoryIO({
    columns: opts.columns ?? 80,
    rows: opts.rows ?? 24,
  });

  const engine = new TerminalEngine({
    io,
    exitHook: false,
    ...opts,
  });

  return { engine, io };
}

export async function commitLines(
  engine: TerminalEngine,
  count: number,
  prefix: string = 'line',
): Promise<void> {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    lines.push(`${prefix} ${i}`);
  }
  engine.commit(lines);
  await engine.flush();
}

/**
 * Strips ANSI escape sequences from a string to inspect visible screen text.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;?]*[a-zA-Z~]/g, '').replace(/\x1b[()][A-Za-z0-9]/g, '');
}

/**
 * Returns an array of lines representing the current visible screen output from MemoryIO output or rendered buffer.
 */
export function getCleanOutput(io: MemoryIO): string {
  return stripAnsi(io.written);
}
