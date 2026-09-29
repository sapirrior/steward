import type { Context } from './context.js';
import { AppContext, StdoutContext, StdinContext, FocusContext } from './context.js';
import type { Key } from '../terminal/input.js';

interface HookSlot {
  type: string;
  value: any;
  deps?: any[];
  cleanup?: (() => void) | void;
}

interface ComponentInstance {
  path: string;
  slots: HookSlot[];
  hookIndex: number;
}

// Global runtime execution state
let currentInstance: ComponentInstance | null = null;
let currentPath = '';
let instancesByPath = new Map<string, ComponentInstance>();
let visitedPathsThisFrame = new Set<string>();
let activeContextValues = new Map<symbol, any>();
let pendingEffects: Array<() => void> = [];
let requestFrameCallback: (() => void) | null = null;
let currentEngineRef: any = null;

export function setRuntimeEngine(engine: any, onRequestFrame: () => void): void {
  currentEngineRef = engine;
  requestFrameCallback = onRequestFrame;
}

export function resetRuntime(): void {
  instancesByPath.clear();
  visitedPathsThisFrame.clear();
  activeContextValues.clear();
  pendingEffects = [];
  currentInstance = null;
  currentPath = '';
  currentEngineRef = null;
  requestFrameCallback = null;
}

export function beginFrame(): void {
  visitedPathsThisFrame.clear();
  pendingEffects = [];
}

export function enterComponent(path: string): void {
  currentPath = path;
  visitedPathsThisFrame.add(path);
  let inst = instancesByPath.get(path);
  if (!inst) {
    inst = {
      path,
      slots: [],
      hookIndex: 0,
    };
    instancesByPath.set(path, inst);
  } else {
    inst.hookIndex = 0;
  }
  currentInstance = inst;
}

export function leaveComponent(): void {
  currentInstance = null;
}

export function endFrame(): void {
  // Sweep unvisited component paths
  for (const [path, inst] of instancesByPath.entries()) {
    if (!visitedPathsThisFrame.has(path)) {
      for (const slot of inst.slots) {
        if (slot.type === 'effect' && typeof slot.cleanup === 'function') {
          try {
            slot.cleanup();
          } catch {}
          slot.cleanup = undefined;
        }
      }
      instancesByPath.delete(path);
    }
  }
}

export function runPendingEffects(): void {
  const effects = pendingEffects;
  pendingEffects = [];
  for (const effect of effects) {
    try {
      effect();
    } catch (e) {
      console.error('Error running effect:', e);
    }
  }
}

function getNextSlot(type: string): { inst: ComponentInstance; slot: HookSlot; isNew: boolean } {
  if (!currentInstance) {
    throw new Error(`Hook called outside of a component render!`);
  }
  const inst = currentInstance;
  const idx = inst.hookIndex++;
  if (idx < inst.slots.length) {
    const slot = inst.slots[idx]!;
    if (slot.type !== type) {
      throw new Error(
        `Hook order changed in component at "${inst.path}". Expected ${slot.type} but got ${type}.`,
      );
    }
    return { inst, slot, isNew: false };
  }

  const newSlot: HookSlot = { type, value: undefined };
  inst.slots.push(newSlot);
  return { inst, slot: newSlot, isNew: true };
}

function areDepsEqual(prev?: any[], next?: any[]): boolean {
  if (!prev || !next || prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return false;
  }
  return true;
}

export function useState<T>(initialValue: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const { slot, isNew } = getNextSlot('state');
  if (isNew) {
    slot.value = typeof initialValue === 'function' ? (initialValue as any)() : initialValue;
  }

  const setState = (next: T | ((prev: T) => T)) => {
    const nextVal = typeof next === 'function' ? (next as any)(slot.value) : next;
    if (!Object.is(slot.value, nextVal)) {
      slot.value = nextVal;
      if (requestFrameCallback) {
        requestFrameCallback();
      }
    }
  };

  return [slot.value, setState];
}

export function useReducer<R extends (state: any, action: any) => any, I>(
  reducer: R,
  initialArg: I,
  init?: (arg: I) => ReturnType<R>,
): [ReturnType<R>, (action: any) => void] {
  const { slot, isNew } = getNextSlot('reducer');
  if (isNew) {
    slot.value = init ? init(initialArg) : initialArg;
  }

  const dispatch = (action: any) => {
    const nextVal = reducer(slot.value, action);
    if (!Object.is(slot.value, nextVal)) {
      slot.value = nextVal;
      if (requestFrameCallback) {
        requestFrameCallback();
      }
    }
  };

  return [slot.value, dispatch];
}

export function useRef<T>(initialValue: T): { current: T } {
  const { slot, isNew } = getNextSlot('ref');
  if (isNew) {
    slot.value = { current: initialValue };
  }
  return slot.value;
}

export function useMemo<T>(factory: () => T, deps: any[]): T {
  const { slot, isNew } = getNextSlot('memo');
  if (isNew || !areDepsEqual(slot.deps, deps)) {
    slot.value = factory();
    slot.deps = deps;
  }
  return slot.value;
}

export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T {
  return useMemo(() => callback, deps);
}

export function useEffect(effect: () => (() => void) | void, deps?: any[]): void {
  const { slot, isNew } = getNextSlot('effect');
  const depsChanged = isNew || !deps || !areDepsEqual(slot.deps, deps);

  if (depsChanged) {
    slot.deps = deps;
    pendingEffects.push(() => {
      if (typeof slot.cleanup === 'function') {
        try {
          slot.cleanup();
        } catch {}
      }
      slot.cleanup = effect();
    });
  }
}

export function useContext<T>(context: Context<T>): T {
  const value = activeContextValues.get(context.id);
  if (value !== undefined) {
    return value;
  }
  return context.defaultValue;
}

export function pushContextValue(id: symbol, value: any): void {
  activeContextValues.set(id, value);
}

export function popContextValue(id: symbol, previousValue: any): void {
  if (previousValue !== undefined) {
    activeContextValues.set(id, previousValue);
  } else {
    activeContextValues.delete(id);
  }
}

// Input listeners registry for useInput / usePaste
const inputHandlers = new Set<(input: string, key: Key) => void>();
const pasteHandlers = new Set<(text: string) => void>();

export function registerInputHandler(fn: (input: string, key: Key) => void): () => void {
  inputHandlers.add(fn);
  return () => inputHandlers.delete(fn);
}

export function registerPasteHandler(fn: (text: string) => void): () => void {
  pasteHandlers.add(fn);
  return () => pasteHandlers.delete(fn);
}

export function dispatchInputEvent(input: string, key: Key, isPaste = false): void {
  if (isPaste) {
    for (const h of pasteHandlers) {
      h(input);
    }
  }
  for (const h of inputHandlers) {
    h(input, key);
  }
}

export function useInput(
  handler: (input: string, key: Key) => void,
  options: { isActive?: boolean } = {},
): void {
  const isActive = options.isActive ?? true;
  useEffect(() => {
    if (!isActive) return;
    return registerInputHandler(handler);
  }, [isActive, handler]);
}

export function usePaste(
  handler: (text: string) => void,
  options: { isActive?: boolean } = {},
): void {
  const isActive = options.isActive ?? true;
  useEffect(() => {
    if (!isActive) return;
    return registerPasteHandler(handler);
  }, [isActive, handler]);
}

export function useApp(): { exit: (errOrVal?: any) => void; waitUntilRenderFlush: () => Promise<void> } {
  const app = useContext(AppContext);
  return {
    exit: app.exit,
    waitUntilRenderFlush: () => {
      if (currentEngineRef && typeof currentEngineRef.flush === 'function') {
        return currentEngineRef.flush();
      }
      return Promise.resolve();
    },
  };
}

export function useStdout(): { stdout?: any; write: (data: string) => void } {
  const stdout = useContext(StdoutContext);
  return {
    stdout: stdout.stdout,
    write: (data: string) => {
      if (currentEngineRef) {
        currentEngineRef.commit([data], { tag: 'stdout' });
      } else {
        stdout.write(data);
      }
    },
  };
}

export function useStdin(): { stdin?: any; isRawModeSupported: boolean; setRawMode: (on: boolean) => void } {
  return useContext(StdinContext);
}

export function useWindowSize(): { columns: number; rows: number } {
  const [size, setSize] = useState(() => ({
    columns: currentEngineRef?.io?.columns ?? 80,
    rows: currentEngineRef?.io?.rows ?? 24,
  }));

  useEffect(() => {
    if (!currentEngineRef?.io?.onResize) return;
    return currentEngineRef.io.onResize(() => {
      setSize({
        columns: currentEngineRef.io.columns,
        rows: currentEngineRef.io.rows,
      });
    });
  }, []);

  return size;
}

export function useCursor(): { setCursorPosition: (pos?: { x: number; y: number }) => void } {
  return {
    setCursorPosition: (pos) => {
      // Handled via engine cursor request
      if (currentEngineRef && pos) {
        // Will be applied in current frame
      }
    },
  };
}

// Shared animation timer registry
let animationTimer: ReturnType<typeof setInterval> | null = null;
let animationSubscribers = new Set<() => void>();

function subscribeAnimation(cb: () => void) {
  animationSubscribers.add(cb);
  if (!animationTimer && animationSubscribers.size > 0) {
    animationTimer = setInterval(() => {
      for (const sub of animationSubscribers) {
        sub();
      }
    }, 100);
  }
  return () => {
    animationSubscribers.delete(cb);
    if (animationSubscribers.size === 0 && animationTimer) {
      clearInterval(animationTimer);
      animationTimer = null;
    }
  };
}

export function useAnimation(options: { interval?: number; isActive?: boolean } = {}): {
  frame: number;
  time: number;
  delta: number;
  reset: () => void;
} {
  const isActive = options.isActive ?? true;
  const [state, setState] = useState(() => ({ frame: 0, time: Date.now(), delta: 0 }));

  useEffect(() => {
    if (!isActive) return;
    let last = Date.now();
    return subscribeAnimation(() => {
      const now = Date.now();
      setState((prev) => ({
        frame: prev.frame + 1,
        time: now,
        delta: now - last,
      }));
      last = now;
    });
  }, [isActive]);

  return {
    frame: state.frame,
    time: state.time,
    delta: state.delta,
    reset: () => setState({ frame: 0, time: Date.now(), delta: 0 }),
  };
}

export function useScroll(): {
  offset: number;
  max: number;
  scrollBy: (delta: number) => void;
  scrollTo: (offset: number) => void;
  scrollToBottom: () => void;
} {
  const scrollState = currentEngineRef ? currentEngineRef.getScrollState() : { offset: 0, max: 0 };
  return {
    offset: scrollState.offset,
    max: scrollState.max,
    scrollBy: (delta: number) => currentEngineRef?.scrollBy(delta),
    scrollTo: (offset: number) => currentEngineRef?.scrollTo(offset),
    scrollToBottom: () => currentEngineRef?.scrollToBottom(),
  };
}

export function useFocus(options: { autoFocus?: boolean; isActive?: boolean; id?: string } = {}): {
  isFocused: boolean;
  focus: () => void;
} {
  const focusManager = useContext(FocusContext);
  const idRef = useRef(options.id ?? `focus-${Math.random().toString(36).slice(2, 8)}`);
  const id = idRef.current;
  const isActive = options.isActive ?? true;

  useEffect(() => {
    if (!isActive) return;
    focusManager.register(id, options.autoFocus);
    return () => focusManager.unregister(id);
  }, [id, isActive, options.autoFocus]);

  return {
    isFocused: focusManager.isFocusEnabled && focusManager.activeId === id,
    focus: () => focusManager.focus(id),
  };
}

export function useFocusManager(): FocusContextValue {
  return useContext(FocusContext);
}
