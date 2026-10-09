import type { ElementChild } from '../types.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import Component from '../engine/Component.js';
import { reconcileRoot, unmountTree } from '../reconciler/reconcile.js';
import type { ComponentInstance } from '../reconciler/instance.js';
import { renderElement } from '../elements/index.js';
import { AppScheduler } from './AppScheduler.js';

export interface AppRootOptions {
  engine?: TerminalEngine;
  onError?: (error: Error) => void;
}

export class AppRoot {
  readonly engine: TerminalEngine;
  private rootElement: ElementChild;
  private instanceTree: ComponentInstance | null = null;
  private scheduler: AppScheduler;
  private rootComponent: RootLineComponent;
  private isUnmounted = false;
  private onError?: (error: Error) => void;

  constructor(element: ElementChild, options: AppRootOptions = {}) {
    this.rootElement = element;
    this.engine = options.engine ?? new TerminalEngine();
    this.onError = options.onError;

    this.scheduler = new AppScheduler(this.engine, () => {
      this.render();
    });

    this.rootComponent = new RootLineComponent(() => this.getRenderedLines());
    this.rootComponent.wrap = false;
    this.rootComponent.clip = false;

    this.engine.mount(this.rootComponent);
    this.render();
  }

  private getRenderedLines(): string[] {
    if (!this.instanceTree) return [];
    const element = this.instanceTree.element;
    return renderElement(element, {
      width: this.engine.io.columns,
      colorLevel: this.engine.io.colorLevel,
    });
  }

  render(nextElement?: ElementChild): void {
    if (this.isUnmounted) return;
    if (nextElement !== undefined) {
      this.rootElement = nextElement;
    }

    try {
      this.instanceTree = reconcileRoot(this.instanceTree, this.rootElement, {
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

    if (this.instanceTree) {
      unmountTree(this.instanceTree);
      this.instanceTree = null;
    }
    this.engine.unmount(this.rootComponent);
  }
}

class RootLineComponent extends Component {
  private lineProducer: () => string[];

  constructor(lineProducer: () => string[]) {
    super();
    this.lineProducer = lineProducer;
  }

  renderWithCursor(_width?: number) {
    return {
      lines: this.lineProducer(),
      cursor: null,
    };
  }
}
