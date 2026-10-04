import Component from './Component.js';
import HistoryStore from './HistoryStore.js';
import StateRenderer from './StateRenderer.js';
import { DocumentTree, type ComponentNode } from './DocumentTree.js';
import { ScrollModel, type ScrollSnapshot } from './scroll.js';
import {
  InputParser,
  ESC_TIMEOUT_MS,
  PASTE_IDLE_MS,
  type InputEvent,
  type TerminalEvent,
} from '../terminal/input.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN,
  ENABLE_FOCUS_REPORTING,
  DISABLE_FOCUS_REPORTING,
  ENABLE_BRACKETED_PASTE,
  DISABLE_BRACKETED_PASTE,
  ENABLE_MOUSE_ALL,
  DISABLE_MOUSE_ALL,
  ENABLE_AUTOWRAP,
  DISABLE_AUTOWRAP,
  CURSOR_HOME,
  HIDE_CURSOR,
  SHOW_CURSOR,
} from '../terminal/sequences.js';

class ComponentNodeAdapter implements ComponentNode {
  id: string;
  comp: Component;

  constructor(id: string, comp: Component) {
    this.id = id;
    this.comp = comp;
  }

  get wrap(): boolean {
    return this.comp.wrap;
  }

  get clip(): boolean {
    return this.comp.clip;
  }

  get ellipsis(): boolean {
    return this.comp.ellipsis;
  }

  getLines(width: number, forceAll?: boolean): string[] {
    return this.comp._getLines(width, forceAll);
  }

  getLogicalCursor(): { logicalLineIndex: number; characterOffsetWithinLine: number } | null {
    if (typeof this.comp.getLogicalCursor === 'function') {
      return this.comp.getLogicalCursor();
    }
    return null;
  }

  onMount(): void {
    if (typeof this.comp.onMount === 'function') {
      this.comp.onMount();
    }
  }

  onUnmount(): void {
    if (typeof this.comp.onUnmount === 'function') {
      this.comp.onUnmount();
    }
  }

  onResize(width: number, height: number): void {
    if (typeof this.comp.onResize === 'function') {
      this.comp.onResize(width, height);
    }
  }
}

export interface TerminalEngineOptions {
  io?: TerminalIO;
  onError?: (err: unknown, ctx?: { source: string; forcedFull: boolean }) => void;
  exitHook?: boolean;
  mouse?: boolean;
  scrollKeys?: boolean;
  focusReporting?: boolean;
  onOverflow?: (info: { width: number; maxCols: number; row: string }) => void;
  maxFps?: number;
  historyLimit?: number;
}

export class TerminalEngine {
  readonly io: TerminalIO;
  tree: DocumentTree;
  history: HistoryStore;
  components: Component[];
  private adapters: Map<Component, ComponentNodeAdapter>;
  private renderer: StateRenderer;
  dirty: boolean;
  cursorHidden: boolean;
  inAlternateScreen: boolean;
  private scrollModel: ScrollModel;

  private onError?: (err: unknown, ctx?: { source: string; forcedFull: boolean }) => void;
  private exitHook: boolean;
  private mouse: boolean;
  private scrollKeys: boolean;
  private focusReporting: boolean;
  private onOverflow?: (info: { width: number; maxCols: number; row: string }) => void;
  private maxFps?: number;
  private historyLimit?: number;

  private resizeHandler: () => void;
  private inputHandler: (str: string) => void;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private escTimer: ReturnType<typeof setTimeout> | null = null;
  private pasteTimer: ReturnType<typeof setTimeout> | null = null;
  private inputParser = new InputParser();
  private lastRenderTime = 0;
  private pendingFlushResolvers: Array<() => void> = [];
  private cleanupResizeListener: (() => void) | null = null;
  private cleanupInputListener: (() => void) | null = null;
  private exitHookFn: (() => void) | null = null;

  private idCounter = 0;
  private pendingForceFull = false;
  private lineWidthCache: Map<string, number> = new Map();
  private customInputListeners: Array<(ev: InputEvent) => boolean | void> = [];
  private consecutiveRenderFailures = 0;
  private disposed = false;

  constructor(options: TerminalEngineOptions = {}) {
    this.io = options.io ?? nodeIO();
    this.onError = options.onError;
    this.exitHook = options.exitHook ?? true;
    this.mouse = options.mouse ?? false;
    this.scrollKeys = options.scrollKeys ?? true;
    this.focusReporting = options.focusReporting ?? false;
    this.onOverflow = options.onOverflow;
    this.maxFps = options.maxFps;
    this.historyLimit = options.historyLimit;

    this.tree = new DocumentTree({ historyLimit: this.historyLimit });
    this.history = new HistoryStore({ historyLimit: this.historyLimit });
    this.components = [];
    this.adapters = new Map();
    this.renderer = new StateRenderer();
    this.dirty = false;
    this.cursorHidden = false;
    this.inAlternateScreen = false;
    this.scrollModel = new ScrollModel();

    // Window resize & zoom handler: debounced for smooth reflow
    this.resizeHandler = () => {
      this.renderer.clearPreviousFrameRecord();
      for (const comp of this.components) {
        comp.markDirty();
      }

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }
      this.resizeTimer = setTimeout(() => {
        const w = this.io.columns;
        const h = this.io.rows;
        this.tree.invalidateCache();
        for (const comp of this.components) {
          if (typeof comp.onResize === 'function') {
            comp.onResize(w, h);
          }
        }
        this.requestFrame(true);
      }, 50);
    };

    const dispatchTerminalEvent = (ev: TerminalEvent) => {
      if (ev.type === 'focus') {
        return;
      }

      if (ev.type === 'mouse') {
        if (ev.action === 'wheel') {
          if (ev.button === 'wheelUp') {
            this.scrollBy(3);
          } else if (ev.button === 'wheelDown') {
            this.scrollBy(-3);
          }
        }
        return;
      }

      if (ev.type === 'key') {
        if (this.scrollKeys) {
          const step = Math.max(1, this.io.rows - 1);
          if (ev.key.name === 'pageup' || ev.key.pageUp) {
            this.scrollBy(step);
            return;
          }
          if (ev.key.name === 'pagedown' || ev.key.pageDown) {
            this.scrollBy(-step);
            return;
          }
          if (ev.key.name === 'home' && (ev.key.ctrl || ev.key.shift)) {
            this.scrollToTop();
            return;
          }
          if (ev.key.name === 'end' && (ev.key.ctrl || ev.key.shift)) {
            this.scrollToBottom();
            return;
          }
        }

        // Non-scroll key: auto snap to bottom when scrolled up
        if (this.scrollModel.snapshot().offset > 0) {
          this.scrollToBottom();
        }

        // Deliver key event to registered listeners
        for (let i = this.customInputListeners.length - 1; i >= 0; i--) {
          const listener = this.customInputListeners[i];
          if (listener) {
            const handled = listener(ev);
            if (handled) return;
          }
        }
        return;
      }

      if (ev.type === 'paste') {
        if (this.scrollModel.snapshot().offset > 0) {
          this.scrollToBottom();
        }

        for (let i = this.customInputListeners.length - 1; i >= 0; i--) {
          const listener = this.customInputListeners[i];
          if (listener) {
            const handled = listener(ev);
            if (handled) return;
          }
        }
        return;
      }
    };

    // Central keyboard and ANSI input dispatch
    this.inputHandler = (chunk: string) => {
      if (!this.inAlternateScreen || this.disposed) return;
      const str = typeof chunk === 'string' ? chunk : String(chunk);
      const events = this.inputParser.feed(str);

      if (this.inputParser.pending) {
        if (this.escTimer) clearTimeout(this.escTimer);
        this.escTimer = setTimeout(() => {
          this.escTimer = null;
          const flushed = this.inputParser.flush();
          for (const ev of flushed) {
            dispatchTerminalEvent(ev);
          }
        }, ESC_TIMEOUT_MS);
      } else if (this.escTimer) {
        clearTimeout(this.escTimer);
        this.escTimer = null;
      }

      if (this.inputParser.inPaste) {
        if (this.pasteTimer) clearTimeout(this.pasteTimer);
        this.pasteTimer = setTimeout(() => {
          this.pasteTimer = null;
          const flushed = this.inputParser.flushPaste();
          for (const ev of flushed) {
            dispatchTerminalEvent(ev);
          }
        }, PASTE_IDLE_MS);
      } else if (this.pasteTimer) {
        clearTimeout(this.pasteTimer);
        this.pasteTimer = null;
      }

      for (const ev of events) {
        dispatchTerminalEvent(ev);
      }
    };
  }

  addInputListener(listener: (ev: InputEvent) => boolean | void): () => void {
    this.customInputListeners.push(listener);
    return () => {
      this.customInputListeners = this.customInputListeners.filter((l) => l !== listener);
    };
  }

  scrollBy(amount: number): void {
    this.scrollModel.scrollBy(amount);
    this.requestFrame();
  }

  scrollUp(amount = 1): void {
    this.scrollBy(amount);
  }

  scrollDown(amount = 1): void {
    this.scrollBy(-amount);
  }

  scrollTo(offset: number): void {
    this.scrollModel.scrollTo(offset);
    this.requestFrame();
  }

  scrollToBottom(): void {
    this.scrollModel.toBottom();
    this.requestFrame();
  }

  scrollToTop(): void {
    this.scrollModel.toTop();
    this.requestFrame();
  }

  getScrollState(): ScrollSnapshot {
    return this.scrollModel.snapshot();
  }

  ensureAlternateScreen(): void {
    if (!this.inAlternateScreen && !this.disposed) {
      let enterSeq = ENTER_ALTERNATE_SCREEN;
      if (this.focusReporting) enterSeq += ENABLE_FOCUS_REPORTING;
      enterSeq += ENABLE_BRACKETED_PASTE;
      if (this.mouse) enterSeq += ENABLE_MOUSE_ALL;
      enterSeq += `${DISABLE_AUTOWRAP}${CURSOR_HOME}`;

      this.io.write(enterSeq);
      this.inAlternateScreen = true;

      if (this.io.isTTY) {
        this.io.input.setRaw(true);
        this.io.input.resume();
      }
      this.cleanupInputListener = this.io.input.onData(this.inputHandler);
      this.cleanupResizeListener = this.io.onResize(this.resizeHandler);

      if (this.exitHook && !this.exitHookFn && typeof process !== 'undefined' && process.on) {
        this.exitHookFn = () => this.cleanupSync();
        process.on('exit', this.exitHookFn);
      }
    }
  }

  cleanupSync(): void {
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    if (this.pasteTimer) {
      clearTimeout(this.pasteTimer);
      this.pasteTimer = null;
    }
    this.inputParser.reset();

    this.showCursor();
    if (this.inAlternateScreen) {
      let exitSeq = ENABLE_AUTOWRAP;
      if (this.mouse) exitSeq += DISABLE_MOUSE_ALL;
      exitSeq += DISABLE_BRACKETED_PASTE;
      if (this.focusReporting) exitSeq += DISABLE_FOCUS_REPORTING;
      exitSeq += EXIT_ALTERNATE_SCREEN;

      this.io.write(exitSeq);
      this.inAlternateScreen = false;
      try {
        if (this.io.isTTY) this.io.input.setRaw(false);
      } catch {}
      try {
        this.io.input.pause();
      } catch {}
    }

    if (this.exitHookFn && typeof process !== 'undefined' && process.off) {
      process.off('exit', this.exitHookFn);
      this.exitHookFn = null;
    }
  }

  async exitAlternateScreen(): Promise<void> {
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    if (this.pasteTimer) {
      clearTimeout(this.pasteTimer);
      this.pasteTimer = null;
    }
    this.inputParser.reset();

    this.showCursor();
    if (this.inAlternateScreen) {
      let exitSeq = ENABLE_AUTOWRAP;
      if (this.mouse) exitSeq += DISABLE_MOUSE_ALL;
      exitSeq += DISABLE_BRACKETED_PASTE;
      if (this.focusReporting) exitSeq += DISABLE_FOCUS_REPORTING;
      exitSeq += EXIT_ALTERNATE_SCREEN;

      this.io.write(exitSeq);
      this.inAlternateScreen = false;

      if (this.cleanupInputListener) {
        this.cleanupInputListener();
        this.cleanupInputListener = null;
      }
      try {
        if (this.io.isTTY) this.io.input.setRaw(false);
      } catch {}
      this.io.input.pause();

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = null;
      }
      if (this.cleanupResizeListener) {
        this.cleanupResizeListener();
        this.cleanupResizeListener = null;
      }
    }

    if (this.exitHookFn && typeof process !== 'undefined' && process.off) {
      process.off('exit', this.exitHookFn);
      this.exitHookFn = null;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.escTimer) {
      clearTimeout(this.escTimer);
      this.escTimer = null;
    }
    if (this.pasteTimer) {
      clearTimeout(this.pasteTimer);
      this.pasteTimer = null;
    }
    this.inputParser.reset();
    this.cleanupSync();

    if (this.cleanupInputListener) {
      this.cleanupInputListener();
      this.cleanupInputListener = null;
    }
    try {
      this.io.input.pause();
    } catch {}
    if (this.cleanupResizeListener) {
      this.cleanupResizeListener();
      this.cleanupResizeListener = null;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.resolveFlushPromises();

    for (const comp of this.components) {
      if (typeof comp.onUnmount === 'function') {
        comp.onUnmount();
      }
    }
    this.components = [];
    this.adapters.clear();
    this.customInputListeners = [];
  }

  hideCursor(): void {
    if (!this.cursorHidden) {
      this.io.write(HIDE_CURSOR);
      this.cursorHidden = true;
    }
  }

  showCursor(): void {
    if (this.cursorHidden) {
      this.io.write(SHOW_CURSOR);
      this.cursorHidden = false;
    }
  }

  commit(
    linesOrFn: string[] | ((width: number) => string[]),
    opts?: { wrap?: boolean; clip?: boolean; hangingIndent?: number; tag?: string },
  ): void {
    this.ensureAlternateScreen();
    const isWrappable = opts?.wrap ?? true;
    const isClipped = opts?.clip ?? !isWrappable;
    if (typeof linesOrFn === 'function') {
      const initialLines = linesOrFn(this.io.columns);
      this.history.push(initialLines, opts?.tag);
      this.tree.addResponsive(linesOrFn, isWrappable, isClipped, opts?.hangingIndent);
    } else {
      this.history.push(linesOrFn, opts?.tag);
      this.tree.addText(linesOrFn, isWrappable, undefined, opts?.hangingIndent, isClipped);
    }
    this.requestFrame();
  }

  mount(component: Component, options: { keepCursorVisible?: boolean } = {}): void {
    this.ensureAlternateScreen();
    // If component is already mounted, unmount previous adapter first to avoid duplicate nodes
    if (this.adapters.has(component)) {
      this.unmount(component);
    }

    component.engine = this;
    this.components.push(component);

    const adapter = new ComponentNodeAdapter(`comp-${this.idCounter++}`, component);
    this.adapters.set(component, adapter);
    this.tree.mountNode(adapter);

    if (options.keepCursorVisible) {
      this.showCursor();
    } else {
      this.hideCursor();
    }

    this.requestFrame();
  }

  unmount(component: Component): void {
    const adapter = this.adapters.get(component);
    if (adapter) {
      this.tree.unmountNode(adapter);
      this.adapters.delete(component);
    }
    this.components = this.components.filter((c) => c !== component);
    this.requestFrame();
  }

  clear(): void {
    this.renderer.clearPreviousFrameRecord();
  }

  clearAll(): void {
    this.tree.clearAll();
    this.history.clearAll();
    this.components = [];
    this.adapters.clear();
    this.renderer.clearPreviousFrameRecord();
    this.requestFrame(true);
  }

  private resolveFlushPromises(): void {
    if (this.pendingFlushResolvers.length > 0) {
      const resolvers = this.pendingFlushResolvers;
      this.pendingFlushResolvers = [];
      for (const res of resolvers) {
        res();
      }
    }
  }

  private performRender(): void {
    this.dirty = false;
    this.lastRenderTime = Date.now();
    if (this.disposed || !this.inAlternateScreen) {
      this.resolveFlushPromises();
      return;
    }

    const shouldForceFull = this.pendingForceFull;
    this.pendingForceFull = false;

    try {
      this.renderer.render(
        this.tree,
        this.scrollModel,
        shouldForceFull,
        this.lineWidthCache,
        this.io,
        this.onOverflow,
      );
      this.consecutiveRenderFailures = 0;
    } catch (err) {
      this.consecutiveRenderFailures += 1;
      if (this.onError) {
        this.onError(err, { source: 'render-frame', forcedFull: shouldForceFull });
      }

      if (this.consecutiveRenderFailures >= 3) {
        this.resolveFlushPromises();
        throw err;
      }

      this.pendingForceFull = true;
      this.requestFrame(true);
      return;
    }

    this.resolveFlushPromises();
  }

  private renderScheduled = false;

  requestFrame(forceFull = false): void {
    this.pendingForceFull = this.pendingForceFull || forceFull;
    if (this.disposed) return;
    this.dirty = true;

    if (this.maxFps && this.maxFps > 0) {
      const minInterval = 1000 / this.maxFps;
      const now = Date.now();
      const elapsed = now - this.lastRenderTime;

      if (elapsed >= minInterval && !this.renderScheduled && !this.renderTimer) {
        this.renderScheduled = true;
        queueMicrotask(() => {
          this.renderScheduled = false;
          if (this.dirty && !this.disposed && !this.renderTimer) {
            this.performRender();
          }
        });
      } else if (!this.renderTimer && !this.renderScheduled) {
        const wait = Math.max(1, minInterval - elapsed);
        this.renderTimer = setTimeout(() => {
          this.renderTimer = null;
          if (this.dirty && !this.disposed) {
            this.performRender();
          }
        }, wait);
      }
      return;
    }

    if (!this.renderScheduled) {
      this.renderScheduled = true;
      queueMicrotask(() => {
        this.renderScheduled = false;
        if (this.dirty && !this.disposed) {
          this.performRender();
        }
      });
    }
  }

  flush(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (!this.dirty && !this.renderTimer && !this.pendingForceFull && !this.renderScheduled) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.pendingFlushResolvers.push(resolve);
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
        this.renderTimer = null;
      }
      this.renderScheduled = false;
      this.performRender();
    });
  }
}

export default TerminalEngine;
