import Component from './Component.js';
import HistoryStore from './HistoryStore.js';
import StateRenderer from './StateRenderer.js';
import { DocumentTree, type ComponentNode } from './DocumentTree.js';
import { nodeIO, type TerminalIO } from '../terminal/io.js';
import {
  ENTER_ALTERNATE_SCREEN,
  EXIT_ALTERNATE_SCREEN,
  ENABLE_FOCUS_REPORTING,
  DISABLE_FOCUS_REPORTING,
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
  scrollOffset: number;

  private onError?: (err: unknown, ctx?: { source: string; forcedFull: boolean }) => void;
  private exitHook: boolean;
  private mouse: boolean;
  private scrollKeys: boolean;
  private focusReporting: boolean;
  private onOverflow?: (info: { width: number; maxCols: number; row: string }) => void;

  private resizeHandler: () => void;
  private inputHandler: (str: string) => void;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupResizeListener: (() => void) | null = null;
  private cleanupInputListener: (() => void) | null = null;
  private exitHookFn: (() => void) | null = null;

  private idCounter = 0;
  private pendingForceFull = false;
  private lineWidthCache: Map<string, number> = new Map();
  private customInputListeners: Array<(chunk: string | Buffer) => boolean | void> = [];
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

    this.tree = new DocumentTree();
    this.history = new HistoryStore();
    this.components = [];
    this.adapters = new Map();
    this.renderer = new StateRenderer();
    this.dirty = false;
    this.cursorHidden = false;
    this.inAlternateScreen = false;
    this.scrollOffset = 0;

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
        if (this.scrollOffset > 0) {
          this.scrollOffset = 0;
        }
        this.requestFrame(true);
      }, 50);
    };

    // Keyboard navigation handler
    this.inputHandler = (chunk: string) => {
      if (!this.inAlternateScreen || this.disposed) return;

      const str = typeof chunk === 'string' ? chunk : String(chunk);

      // Consume focus tracking event escapes (Mode 1004: \x1b[I = focus in, \x1b[O = focus out)
      if (
        str === '\x1b[I' ||
        str === '\x1b[O' ||
        str.startsWith('\x1b[I') ||
        str.startsWith('\x1b[O')
      ) {
        return;
      }

      // Check registered custom input listeners first
      for (let i = this.customInputListeners.length - 1; i >= 0; i--) {
        const listener = this.customInputListeners[i];
        if (listener) {
          const handled = listener(str);
          if (handled) return;
        }
      }

      if (this.mouse) {
        // SGR Extended Mouse reporting: \x1b[<btn;col;row[M|m]
        if (str.includes('\x1b[<')) {
          const sgrRegex = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
          let sgrMatch: RegExpExecArray | null;
          let handledMouse = false;
          while ((sgrMatch = sgrRegex.exec(str)) !== null) {
            handledMouse = true;
            const btn = parseInt(sgrMatch[1], 10);
            if ((btn & 64) === 64) {
              if ((btn & 1) === 1) {
                this.scrollDown(3);
              } else {
                this.scrollUp(3);
              }
            }
          }
          if (handledMouse) return;
        }

        // Legacy X10 / Normal Mouse reporting: \x1b[M b col row
        if (str.includes('\x1b[M')) {
          const legacyRegex = /\x1b\[M([\x20-\xff])([\x20-\xff])([\x20-\xff])/g;
          let legMatch: RegExpExecArray | null;
          let handledLegacy = false;
          while ((legMatch = legacyRegex.exec(str)) !== null) {
            handledLegacy = true;
            const btn = legMatch[1].charCodeAt(0) - 32;
            if (btn === 64) {
              this.scrollUp(3);
            } else if (btn === 65) {
              this.scrollDown(3);
            }
          }
          if (handledLegacy) return;
        }
      }

      if (this.scrollKeys) {
        const halfPage = Math.max(1, Math.floor((this.io.rows - 1) / 2));

        // PageUp / PageDown / Ctrl+U / Ctrl+D scrolling
        if (str === '\x04') {
          this.scrollDown(halfPage);
          return;
        }
        if (str === '\x15') {
          this.scrollUp(halfPage);
          return;
        }
        if (str === '\x1b[6~') {
          this.scrollDown(5);
          return;
        }
        if (str === '\x1b[5~') {
          this.scrollUp(5);
          return;
        }
      }
    };
  }

  addInputListener(listener: (chunk: string | Buffer) => boolean | void): () => void {
    this.customInputListeners.push(listener);
    return () => {
      this.customInputListeners = this.customInputListeners.filter((l) => l !== listener);
    };
  }

  scrollUp(amount = 3): void {
    this.scrollOffset += amount;
    this.requestFrame();
  }

  scrollDown(amount = 3): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - amount);
    this.requestFrame();
  }

  scrollToBottom(): void {
    this.scrollOffset = 0;
    this.requestFrame();
  }

  ensureAlternateScreen(): void {
    if (!this.inAlternateScreen && !this.disposed) {
      let enterSeq = ENTER_ALTERNATE_SCREEN;
      if (this.focusReporting) enterSeq += ENABLE_FOCUS_REPORTING;
      if (this.mouse) enterSeq += ENABLE_MOUSE_ALL;
      enterSeq += `${DISABLE_AUTOWRAP}${CURSOR_HOME}`;

      this.io.write(enterSeq);
      this.inAlternateScreen = true;

      if (this.io.isTTY) {
        this.io.input.setRaw(true);
        this.io.input.resume();
        this.cleanupInputListener = this.io.input.onData(this.inputHandler);
      }
      this.cleanupResizeListener = this.io.onResize(this.resizeHandler);

      if (this.exitHook && !this.exitHookFn && typeof process !== 'undefined' && process.on) {
        this.exitHookFn = () => this.cleanupSync();
        process.on('exit', this.exitHookFn);
      }
    }
  }

  cleanupSync(): void {
    this.showCursor();
    if (this.inAlternateScreen) {
      let exitSeq = ENABLE_AUTOWRAP;
      if (this.mouse) exitSeq += DISABLE_MOUSE_ALL;
      if (this.focusReporting) exitSeq += DISABLE_FOCUS_REPORTING;
      exitSeq += EXIT_ALTERNATE_SCREEN;

      this.io.write(exitSeq);
      this.inAlternateScreen = false;
      try {
        if (this.io.isTTY) this.io.input.setRaw(false);
      } catch {}
    }

    if (this.exitHookFn && typeof process !== 'undefined' && process.off) {
      process.off('exit', this.exitHookFn);
      this.exitHookFn = null;
    }
  }

  async exitAlternateScreen(): Promise<void> {
    this.showCursor();
    if (this.inAlternateScreen) {
      let exitSeq = ENABLE_AUTOWRAP;
      if (this.mouse) exitSeq += DISABLE_MOUSE_ALL;
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
    this.cleanupSync();

    if (this.cleanupInputListener) {
      this.cleanupInputListener();
      this.cleanupInputListener = null;
    }
    if (this.cleanupResizeListener) {
      this.cleanupResizeListener();
      this.cleanupResizeListener = null;
    }
    if (this.resizeTimer) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }

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
      this.tree.addResponsive(
        linesOrFn,
        isWrappable,
        isClipped,
        opts?.hangingIndent,
      );
    } else {
      this.history.push(linesOrFn, opts?.tag);
      this.tree.addText(linesOrFn, isWrappable, undefined, opts?.hangingIndent, isClipped);
    }
    this.requestFrame();
  }

  mount(
    component: Component,
    options: { keepCursorVisible?: boolean } = {},
  ): void {
    this.ensureAlternateScreen();
    // If component is already mounted, unmount previous adapter first to avoid duplicate nodes
    if (this.adapters.has(component)) {
      this.unmount(component);
    }

    component.engine = this;
    this.components.push(component);

    const adapter = new ComponentNodeAdapter(
      `comp-${this.idCounter++}`,
      component,
    );
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

  requestFrame(forceFull = false): void {
    this.pendingForceFull = this.pendingForceFull || forceFull;
    if (this.dirty || this.disposed) return;
    this.dirty = true;

    queueMicrotask(() => {
      if (this.dirty && !this.disposed) {
        this.dirty = false;
        const shouldForceFull = this.pendingForceFull;
        this.pendingForceFull = false;
        if (this.inAlternateScreen) {
          try {
            const frame = this.renderer.render(
              this.tree,
              this.scrollOffset,
              shouldForceFull,
              this.lineWidthCache,
              this.io,
              this.onOverflow,
            );
            this.scrollOffset = frame.currentScrollOffset;
            // Reset failure counter on any successful render.
            this.consecutiveRenderFailures = 0;
          } catch (err) {
            this.consecutiveRenderFailures += 1;
            if (this.onError) {
              this.onError(err, { source: 'render-frame', forcedFull: shouldForceFull });
            }

            if (this.consecutiveRenderFailures >= 3) {
              // Three consecutive failures: real corruption, not a transient glitch.
              throw err;
            }

            // Transient failure: force a full repaint on the next tick
            this.pendingForceFull = true;
            this.requestFrame(true);
          }
        }
      }
    });
  }
}

export default TerminalEngine;
