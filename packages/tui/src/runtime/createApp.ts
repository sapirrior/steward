import { TerminalEngine, type TerminalEngineOptions } from '../engine/TerminalEngine.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import { mount, type UIContext, type UIHandle, type MountOptions } from './mount.js';

export interface CreateAppOptions<S extends object> extends MountOptions<S> {
  io?: TerminalIO;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  maxFps?: number;
  mouse?: boolean;
  scrollKeys?: boolean;
  historyLimit?: number;
  onError?: (err: unknown) => void;
  interactive?: boolean;
}

/**
 * Creates and runs a Stitchable TUI application with automatic engine management.
 * 
 * @example
 * ```ts
 * const app = createApp((state, ctx) => {
 *   return Box({}, Text({ bold: true }, `Count: ${state.count}`));
 * }, {
 *   state: { count: 0 },
 *   onKey(input, key, state, ctx) {
 *     if (input === 'q') ctx.exit();
 *     if (key.upArrow) { state.count++; ctx.invalidate(); }
 *   }
 * });
 * ```
 */
export function createApp<S extends object = Record<string, any>>(
  renderFn: (state: S, ctx: UIContext) => any,
  options: CreateAppOptions<S> = {},
): UIHandle<S> {
  const io = options.io ?? nodeIO({ stdout: options.stdout, stdin: options.stdin });
  const isInteractive = options.interactive ?? (io.isTTY && !(typeof process !== 'undefined' && process.env.CI));

  const engine = new TerminalEngine({
    io,
    maxFps: options.maxFps ?? 30,
    mouse: options.mouse ?? false,
    scrollKeys: options.scrollKeys ?? true,
    historyLimit: options.historyLimit,
    onError: options.onError,
  });

  if (isInteractive) {
    engine.ensureAlternateScreen();
  }

  return mount(engine, renderFn, options);
}

export default createApp;
