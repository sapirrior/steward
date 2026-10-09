import type { ElementChild } from '../types.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import { AppRoot } from './AppRoot.js';

export interface RenderOptions {
  io?: TerminalIO;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  maxFps?: number;
  mouse?: boolean;
  scrollKeys?: boolean;
  historyLimit?: number;
  onError?: (err: unknown) => void;
  exitOnCtrlC?: boolean;
}

export interface RenderHandle {
  readonly engine: TerminalEngine;
  invalidate(): void;
  exit(errorOrValue?: unknown): void;
  unmount(error?: Error): void;
  waitUntilExit(): Promise<void>;
}

/**
 * Mounts and renders a declarative, hook-driven Stitchable component tree to the terminal.
 *
 * @example
 * ```tsx
 * const { waitUntilExit } = render(<App />);
 * await waitUntilExit();
 * ```
 */
export function render(element: ElementChild, options: RenderOptions = {}): RenderHandle {
  const io = options.io ?? nodeIO({ stdout: options.stdout, stdin: options.stdin });

  const engine = new TerminalEngine({
    io,
    maxFps: options.maxFps ?? 30,
    mouse: options.mouse ?? true,
    scrollKeys: options.scrollKeys ?? true,
    historyLimit: options.historyLimit,
    onError: options.onError,
  });

  engine.ensureAlternateScreen();

  let isUnmounted = false;
  let exitResolver: (() => void) | null = null;
  let exitRejecter: ((err: Error) => void) | null = null;
  const exitPromise = new Promise<void>((resolve, reject) => {
    exitResolver = resolve;
    exitRejecter = reject;
  });

  let root!: AppRoot;

  const handle: RenderHandle = {
    get engine() {
      return engine;
    },
    invalidate() {
      if (!isUnmounted) {
        root.render();
      }
    },
    exit(errorOrValue?: unknown) {
      if (isUnmounted) return;
      handle.unmount(errorOrValue instanceof Error ? errorOrValue : undefined);
    },
    unmount(error?: Error) {
      if (isUnmounted) return;
      isUnmounted = true;

      root.unmount();
      engine.dispose();

      if (error) {
        if (exitRejecter) exitRejecter(error);
      } else {
        if (exitResolver) exitResolver();
      }
    },
    waitUntilExit() {
      return exitPromise;
    },
  };

  root = new AppRoot(element, {
    engine,
    onError: options.onError,
    onExit: (errorOrValue) => {
      handle.exit(errorOrValue);
    },
    exitOnCtrlC: options.exitOnCtrlC ?? true,
  });

  return handle;
}

export default render;
