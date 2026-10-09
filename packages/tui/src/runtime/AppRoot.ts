import type { ElementChild } from '../types.js';
import { jsx } from '../reconciler/element.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import Component from '../engine/Component.js';
import { reconcileRoot, unmountTree } from '../reconciler/reconcile.js';
import type { ComponentInstance } from '../reconciler/instance.js';
import { renderElement } from '../elements/index.js';
import { AppScheduler } from './AppScheduler.js';
import { InputDispatcher } from './InputDispatcher.js';
import { AppContext, type AppContextValue, type CursorPosition } from './AppContext.js';

export interface AppRootOptions {
  engine?: TerminalEngine;
  onError?: (error: Error) => void;
  exitOnCtrlC?: boolean;
}

export class AppRoot {
  readonly engine: TerminalEngine;
  private rootElement: ElementChild;
  private instanceTree: ComponentInstance | null = null;
  private scheduler: AppScheduler;
  private rootComponent: RootLineComponent;
  private inputDispatcher: InputDispatcher;
  private isUnmounted = false;
  private onError?: (error: Error) => void;
  private removeInputListener?: () => void;
  private currentCursor: CursorPosition | null = null;

  constructor(element: ElementChild, options: AppRootOptions = {}) {
    this.rootElement = element;
    this.engine = options.engine ?? new TerminalEngine();
    this.onError = options.onError;
    this.inputDispatcher = new InputDispatcher();

    const exitOnCtrlC = options.exitOnCtrlC ?? true;

    this.scheduler = new AppScheduler(this.engine, () => {
      this.render();
    });

    this.rootComponent = new RootLineComponent(() => {
      const lines = this.getRenderedLines();
      const cursor = this.currentCursor
        ? {
            logicalLineIndex: this.currentCursor.line,
            characterOffsetWithinLine: this.currentCursor.characterOffset,
          }
        : null;
      return { lines, cursor };
    });
    this.rootComponent.wrap = false;
    this.rootComponent.clip = false;

    // Single persistent input listener registration
    this.removeInputListener = this.engine.addInputListener((ev) => {
      if (this.isUnmounted) return;
      if (exitOnCtrlC && ev.type === 'key' && ev.key.ctrl && ev.key.name === 'c') {
        this.unmount();
        return true;
      }
      return this.inputDispatcher.dispatch(ev);
    });

    this.engine.mount(this.rootComponent);
    this.render();
  }

  private getRenderedLines(): string[] {
    if (!this.instanceTree) return [];
    const hostElement = extractReconciledElement(this.instanceTree);
    return renderElement(hostElement, {
      width: this.engine.io.columns,
      colorLevel: this.engine.io.colorLevel,
    });
  }

  render(nextElement?: ElementChild): void {
    if (this.isUnmounted) return;
    if (nextElement !== undefined) {
      this.rootElement = nextElement;
    }

    this.currentCursor = null;

    const appContextValue: AppContextValue = {
      engine: this.engine,
      io: this.engine.io,
      exit: (errorOrValue?: unknown) => {
        this.unmount();
        if (errorOrValue instanceof Error && this.onError) {
          this.onError(errorOrValue);
        }
      },
      invalidate: () => {
        this.scheduler.scheduleUpdate();
      },
      inputDispatcher: this.inputDispatcher,
      cursorCollector: {
        setCursor: (pos: CursorPosition | null) => {
          this.currentCursor = pos;
        },
      },
    };

    const wrappedElement = jsx(AppContext.Provider, {
      value: appContextValue,
      children: this.rootElement,
    });

    try {
      this.instanceTree = reconcileRoot(this.instanceTree, wrappedElement, {
        scheduleUpdate: () => this.scheduler.scheduleUpdate(),
        onError: this.onError,
      });

      this.rootComponent.markDirty();
      this.engine.afterNextFrame(() => {
        this.scheduler.flushEffects();
      });
      this.engine.requestFrame();
    } catch (err: any) {
      if (this.onError) {
        this.onError(err);
      } else {
        console.error('Uncaught error during app render:', err);
      }
    }
  }

  unmount(): void {
    if (this.isUnmounted) return;
    this.isUnmounted = true;

    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = undefined;
    }

    if (this.instanceTree) {
      unmountTree(this.instanceTree);
      this.instanceTree = null;
    }
    this.engine.unmount(this.rootComponent);
  }
}

class RootLineComponent extends Component {
  private lineProducer: () => {
    lines: string[];
    cursor: {
      logicalLineIndex: number;
      characterOffsetWithinLine: number;
    } | null;
  };

  constructor(
    lineProducer: () => {
      lines: string[];
      cursor: {
        logicalLineIndex: number;
        characterOffsetWithinLine: number;
      } | null;
    },
  ) {
    super();
    this.lineProducer = lineProducer;
  }

  renderWithCursor(_width?: number) {
    return this.lineProducer();
  }
}

export function extractReconciledElement(instance: ComponentInstance | null): any {
  if (!instance) return null;
  if (instance.tag === 'text') {
    return instance.element;
  }
  if (instance.tag === 'function' || instance.tag === 'class') {
    return extractReconciledElement(instance.renderedChild);
  }
  if (instance.tag === 'fragment') {
    return instance.children.map(extractReconciledElement);
  }
  if (instance.tag === 'host') {
    const extractedChildren = instance.children.map(extractReconciledElement);
    return {
      type: instance.type,
      props: {
        ...instance.props,
        children: extractedChildren,
      },
      children: extractedChildren,
    };
  }
  return instance.element;
}
