import { TerminalEngine } from '../engine/TerminalEngine.js';
import Component from '../engine/Component.js';
import { type TerminalIO } from '../terminal/io.js';
import { makeKey, type Key } from '../terminal/input.js';
import { renderElement } from '../elements/index.js';

export interface UIContext {
  /** Mark component dirty and request next frame */
  invalidate(): void;
  /** Cleanly exit and unmount application */
  exit(errorOrValue?: any): void;
  /** Register a teardown callback (e.g. clearInterval) to run on unmount */
  addCleanup(fn: () => void): void;
  /** Underlying TerminalEngine instance */
  readonly engine: TerminalEngine;
  /** Terminal IO */
  readonly io: TerminalIO;
}

export interface MountOptions<S extends object> {
  /** Initial state object */
  state?: S;
  /** Input key listener (registered once on mount) */
  onKey?(input: string, key: Key, state: S, ctx: UIContext): void;
  /** Lifecycle hook invoked on mount */
  onMount?(state: S, ctx: UIContext): void;
  /** Lifecycle hook invoked on unmount */
  onUnmount?(state: S): void;
  /** Exit process when Ctrl+C is pressed (default: true) */
  exitOnCtrlC?: boolean;
  /** Internal: whether this mount owns and should dispose the engine on unmount */
  ownsEngine?: boolean;
}

export interface UIHandle<S extends object> {
  /** Merge partial state and trigger redraw */
  update(partial: Partial<S>): void;
  /** Trigger redraw without state modification */
  invalidate(): void;
  /** Cleanly unmount application and run cleanups */
  unmount(err?: Error): void;
  /** Promise resolving when application exits */
  waitUntilExit(): Promise<void>;
  /** Underlying state reference */
  readonly state: S;
}

/**
 * Mounts a functional UI component into a TerminalEngine.
 *
 * Guarantees:
 * - Zero hooks / zero dependency array reconciler overhead
 * - Zero closure allocations per frame
 * - Single persistent input listener registration
 * - Guaranteed lifecycle cleanup
 */
export function mount<S extends object = Record<string, any>>(
  engine: TerminalEngine,
  renderFn: (state: S, ctx: UIContext) => any,
  options: MountOptions<S> = {},
): UIHandle<S> {
  const state: S = options.state ?? ({} as S);
  const exitOnCtrlC = options.exitOnCtrlC ?? true;
  const ownsEngine = options.ownsEngine ?? false;
  const cleanups: Array<() => void> = [];

  let isUnmounted = false;
  let exitResolver: (() => void) | null = null;
  let exitRejecter: ((err: any) => void) | null = null;
  let exitError: any = null;

  const exitPromise = new Promise<void>((resolve, reject) => {
    exitResolver = resolve;
    exitRejecter = reject;
  });

  const ctx: UIContext = {
    invalidate() {
      if (!isUnmounted) {
        rootComp.markDirty();
        engine.requestFrame();
      }
    },
    exit(errorOrValue?: any) {
      if (errorOrValue instanceof Error) {
        exitError = errorOrValue;
      }
      unmount(exitError);
    },
    addCleanup(fn: () => void) {
      cleanups.push(fn);
    },
    get engine() {
      return engine;
    },
    get io() {
      return engine.io;
    },
  };

  function resolveElementTree(node: any): any {
    if (node === null || node === undefined || typeof node === 'boolean') {
      return null;
    }
    if (typeof node === 'string' || typeof node === 'number') {
      return String(node);
    }
    if (Array.isArray(node)) {
      return node.map(resolveElementTree);
    }
    if (typeof node === 'object') {
      if (typeof node.type === 'function' && typeof node.render !== 'function') {
        const res = node.type({ ...(node.props || {}), children: node.children });
        return resolveElementTree(res);
      }
      if (node.children) {
        const children = Array.isArray(node.children)
          ? node.children.map(resolveElementTree)
          : resolveElementTree(node.children);
        return {
          ...node,
          props: { ...(node.props || {}), children },
          children,
        };
      }
    }
    return node;
  }

  class FunctionalRootComponent extends Component {
    renderWithCursor(width?: number) {
      const targetWidth = width ?? engine.io.columns;
      const rawTree = renderFn(state, ctx);
      const elementTree = resolveElementTree(rawTree);
      const lines = renderElement(elementTree, {
        width: targetWidth,
        colorLevel: engine.io.colorLevel,
      });
      return {
        lines,
        cursor: null,
      };
    }
  }

  const rootComp = new FunctionalRootComponent();
  rootComp.wrap = false;
  rootComp.clip = false;

  engine.mount(rootComp);

  // Single persistent typed input listener
  const removeInput = engine.addInputListener((ev) => {
    if (isUnmounted) return;
    if (ev.type === 'key') {
      if (exitOnCtrlC && ev.key.ctrl && ev.key.name === 'c') {
        ctx.exit();
        return true;
      }
      if (options.onKey) {
        options.onKey(ev.input, ev.key, state, ctx);
      }
    } else if (ev.type === 'paste') {
      if (options.onKey) {
        options.onKey(ev.text, makeKey('paste', { paste: true }), state, ctx);
      }
    }
  });

  function unmount(err?: Error) {
    if (isUnmounted) return;
    isUnmounted = true;

    // Run registered cleanups first
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (e) {
        console.error('Error in cleanup:', e);
      }
    }
    cleanups.length = 0;

    // Call onUnmount lifecycle callback
    if (options.onUnmount) {
      try {
        options.onUnmount(state);
      } catch (e) {
        console.error('Error in onUnmount:', e);
      }
    }

    removeInput();
    engine.unmount(rootComp);

    if (ownsEngine) {
      engine.dispose();
    }

    if (err) {
      if (exitRejecter) exitRejecter(err);
    } else {
      if (exitResolver) exitResolver();
    }
  }

  // Invoke onMount lifecycle hook
  if (options.onMount) {
    try {
      options.onMount(state, ctx);
    } catch (e) {
      console.error('Error in onMount:', e);
    }
  }

  const handle: UIHandle<S> = {
    update(partial: Partial<S>) {
      if (isUnmounted) return;
      Object.assign(state, partial);
      ctx.invalidate();
    },
    invalidate() {
      ctx.invalidate();
    },
    unmount(err?: Error) {
      unmount(err);
    },
    waitUntilExit() {
      return exitPromise;
    },
    get state() {
      return state;
    },
  };

  return handle;
}

export default mount;
