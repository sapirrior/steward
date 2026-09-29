import { TerminalEngine, type TerminalEngineOptions } from '../engine/TerminalEngine.js';
import Component from '../engine/Component.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import { parseInputChunk } from '../terminal/input.js';
import { renderElement } from '../elements/index.js';
import {
  beginFrame,
  endFrame,
  runPendingEffects,
  enterComponent,
  leaveComponent,
  setRuntimeEngine,
  resetRuntime,
  dispatchInputEvent,
  pushContextValue,
  popContextValue,
} from './hooks.js';
import { AppContext, StdoutContext, StdinContext, FocusContext, type FocusContextValue } from './context.js';
import { patchConsole, restoreConsole } from './console.js';
import type { Instance } from './instance.js';

export interface RenderOptions {
  io?: TerminalIO;
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  exitOnCtrlC?: boolean;
  patchConsole?: boolean;
  onRender?: (lines: string[]) => void;
  maxFps?: number;
  mouse?: boolean;
  scroll?: { keys?: boolean };
  historyLimit?: number;
  onError?: (error: unknown) => void;
  interactive?: boolean;
}

/**
 * Resolves a component tree (function components, hooks, ContextProviders, Static items)
 * into a plain element tree ready for layout.
 */
function resolveTree(
  node: any,
  parentPath: string,
  index: number,
  engine: TerminalEngine,
  staticSeenCounts: Map<string, number>,
): any {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return null;
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child, i) =>
      resolveTree(child, `${parentPath}/${i}`, i, engine, staticSeenCounts),
    );
  }

  if (typeof node === 'object') {
    // ContextProvider
    if (node.type === 'ContextProvider' && node.context) {
      const ctxId = node.context.id;
      const prevVal = undefined;
      pushContextValue(ctxId, node.value);
      const resolvedChildren = (node.children || []).map((c: any, i: number) =>
        resolveTree(c, `${parentPath}/ctx_${i}`, i, engine, staticSeenCounts),
      );
      popContextValue(ctxId, prevVal);
      return resolvedChildren;
    }

    // Static component
    if (node.type === 'Static' || node.type?.name === 'Static') {
      const items = node.props?.items ?? node.items ?? [];
      const renderItem = node.props?.children ?? node.children;
      const staticKey = node.props?.key ?? `${parentPath}/static`;
      const prevCount = staticSeenCounts.get(staticKey) ?? 0;

      if (typeof renderItem === 'function' && items.length > prevCount) {
        for (let i = prevCount; i < items.length; i++) {
          const item = items[i];
          const renderedItem = renderItem(item, i);
          engine.commit((width) => renderElement(renderedItem, { width, colorLevel: engine.io.colorLevel }), {
            tag: 'static',
          });
        }
        staticSeenCounts.set(staticKey, items.length);
      }
      return null;
    }

    // Function component
    if (typeof node.type === 'function') {
      const keyOrIdx = node.props?.key ?? `${index}:${node.type.name || 'Component'}`;
      const compPath = `${parentPath}/${keyOrIdx}`;

      enterComponent(compPath);
      let rendered: any;
      try {
        rendered = node.type({ ...(node.props || {}), children: node.children });
      } finally {
        leaveComponent();
      }

      return resolveTree(rendered, compPath, 0, engine, staticSeenCounts);
    }

    // Plain element (Box, Text, Spacer, Newline, Transform)
    const keyOrIdx = node.props?.key ?? index;
    const elemPath = `${parentPath}/${keyOrIdx}`;

    const childList = Array.isArray(node.children) ? node.children : node.children ? [node.children] : [];
    const resolvedChildren = childList.map((child: any, i: number) =>
      resolveTree(child, `${elemPath}/${i}`, i, engine, staticSeenCounts),
    );

    return {
      type: node.type,
      props: { ...(node.props || {}), children: resolvedChildren },
      children: resolvedChildren,
    };
  }

  return node;
}

export function render(initialTree: any, options: RenderOptions = {}): Instance {
  const io = options.io ?? nodeIO({ stdout: options.stdout, stdin: options.stdin });
  const exitOnCtrlC = options.exitOnCtrlC ?? true;
  const shouldPatchConsole = options.patchConsole ?? true;
  const isInteractive = options.interactive ?? (io.isTTY && !(typeof process !== 'undefined' && process.env.CI));

  let currentTree =
    typeof initialTree === 'function'
      ? { type: initialTree, props: {}, children: [] }
      : initialTree;
  let isUnmounted = false;
  let exitResolver: (() => void) | null = null;
  let exitRejecter: ((err: any) => void) | null = null;
  let exitError: any = null;

  const exitPromise = new Promise<void>((resolve, reject) => {
    exitResolver = resolve;
    exitRejecter = reject;
  });

  const staticSeenCounts = new Map<string, number>();

  // Focus management state
  const focusableIds: string[] = [];
  let currentActiveFocusId: string | null = null;
  let isFocusEnabled = true;

  const focusManager: FocusContextValue = {
    get activeId() {
      return currentActiveFocusId;
    },
    get isFocusEnabled() {
      return isFocusEnabled;
    },
    register(id: string, autoFocus?: boolean) {
      if (!focusableIds.includes(id)) {
        focusableIds.push(id);
        if (autoFocus || currentActiveFocusId === null) {
          currentActiveFocusId = id;
        }
      }
    },
    unregister(id: string) {
      const idx = focusableIds.indexOf(id);
      if (idx !== -1) {
        focusableIds.splice(idx, 1);
        if (currentActiveFocusId === id) {
          currentActiveFocusId = focusableIds[0] ?? null;
        }
      }
    },
    focus(id: string) {
      if (focusableIds.includes(id)) {
        currentActiveFocusId = id;
      }
    },
    focusNext() {
      if (focusableIds.length === 0) return;
      const idx = currentActiveFocusId ? focusableIds.indexOf(currentActiveFocusId) : -1;
      const nextIdx = (idx + 1) % focusableIds.length;
      currentActiveFocusId = focusableIds[nextIdx] ?? null;
    },
    focusPrevious() {
      if (focusableIds.length === 0) return;
      const idx = currentActiveFocusId ? focusableIds.indexOf(currentActiveFocusId) : 0;
      const prevIdx = (idx - 1 + focusableIds.length) % focusableIds.length;
      currentActiveFocusId = focusableIds[prevIdx] ?? null;
    },
    enableFocus() {
      isFocusEnabled = true;
    },
    disableFocus() {
      isFocusEnabled = false;
    },
  };

  const engine = new TerminalEngine({
    io,
    mouse: options.mouse ?? false,
    scrollKeys: options.scroll?.keys ?? true,
    maxFps: options.maxFps,
    historyLimit: options.historyLimit,
    onError: options.onError,
  });

  if (isInteractive) {
    engine.ensureAlternateScreen();
  }

  setRuntimeEngine(engine, () => {
    if (!isUnmounted) {
      engine.requestFrame();
    }
  });

  if (shouldPatchConsole) {
    patchConsole(engine);
  }

  const exitApp = (errOrVal?: any) => {
    if (errOrVal instanceof Error) {
      exitError = errOrVal;
    }
    unmount(exitError);
  };

  // Keyboard input router
  const cleanupInput = engine.addInputListener((chunk) => {
    const events = parseInputChunk(typeof chunk === 'string' ? chunk : String(chunk));
    for (const ev of events) {
      if (exitOnCtrlC && ev.key.ctrl && ev.key.name === 'c') {
        exitApp();
        return true;
      }

      // Tab focus navigation
      if (isFocusEnabled && ev.key.name === 'tab') {
        if (ev.key.shift) {
          focusManager.focusPrevious();
        } else {
          focusManager.focusNext();
        }
        engine.requestFrame();
      }

      dispatchInputEvent(ev.input, ev.key, ev.isPaste);
    }
  });

  class RootComponent extends Component {
    _getLines(width: number): string[] {
      beginFrame();

      // Push all context values before resolving tree
      const prevApp = activeContextValues.get(AppContext.id);
      const prevOut = activeContextValues.get(StdoutContext.id);
      const prevIn = activeContextValues.get(StdinContext.id);
      const prevFocus = activeContextValues.get(FocusContext.id);

      pushContextValue(AppContext.id, { exit: exitApp });
      pushContextValue(StdoutContext.id, { write: (d: string) => io.write(d) });
      pushContextValue(StdinContext.id, {
        stdin: io.input,
        isRawModeSupported: true,
        setRawMode: (on: boolean) => io.input.setRaw(on),
      });
      pushContextValue(FocusContext.id, focusManager);

      let resolved: any;
      try {
        resolved = resolveTree(currentTree, 'root', 0, engine, staticSeenCounts);
      } finally {
        endFrame();
        // Pop context values to prevent accumulation in activeContextValues map
        popContextValue(AppContext.id, prevApp);
        popContextValue(StdoutContext.id, prevOut);
        popContextValue(StdinContext.id, prevIn);
        popContextValue(FocusContext.id, prevFocus);
      }

      const lines = renderElement(resolved, {
        width,
        colorLevel: io.colorLevel,
      });

      if (options.onRender) {
        options.onRender(lines);
      }

      // Schedule effects after paint — guarded: never run after unmount
      queueMicrotask(() => {
        if (!isUnmounted) {
          runPendingEffects();
        }
      });

      return lines;
    }
  }

  const root = new RootComponent();
  root.wrap = false;
  root.clip = false;

  engine.mount(root);

  const unmount = (err?: Error | null) => {
    if (isUnmounted) return;
    isUnmounted = true;

    cleanupInput();
    if (shouldPatchConsole) {
      restoreConsole();
    }

    engine.unmount(root);
    engine.dispose();
    resetRuntime();

    if (err) {
      if (exitRejecter) exitRejecter(err);
    } else {
      if (exitResolver) exitResolver();
    }
  };

  const instance: Instance = {
    rerender(newTree: any) {
      if (isUnmounted) return;
      currentTree = newTree;
      root.markDirty();
      engine.requestFrame();
    },
    unmount,
    waitUntilExit() {
      return exitPromise;
    },
    waitUntilRenderFlush() {
      return engine.flush();
    },
    clear() {
      engine.clear();
    },
    cleanup() {
      unmount();
    },
  };

  return instance;
}

export default render;
