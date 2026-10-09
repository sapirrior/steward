import type TerminalEngine from './TerminalEngine.js';

/**
 * Base Component class.
 * All UI widgets (Prompt, Docks, StreamingView, Header, StatusBar) inherit from this.
 */
export class Component<
  Props extends Record<string, any> = any,
  State extends Record<string, any> = any,
> {
  props: Props;
  state: State;
  engine: TerminalEngine | null = null;
  _dirty = true;
  _lastWidth?: number;
  _cachedLines: string[] = [];
  _updater: { enqueueSetState(inst: Component<any, any>, partial: Partial<any>): void } | null =
    null;

  /** true = word-wrap across rows, false = single row */
  wrap = false;

  /** true = truncate to width, false = never cut */
  clip = true;

  /** Optional ellipsis (...) when clipped */
  ellipsis = false;

  constructor(props: Props = {} as Props) {
    this.props = props;
    this.state = {} as State;
    this.engine = null;
    this._dirty = true;
    this._cachedLines = [];
  }

  componentDidMount?(): void;
  componentDidUpdate?(previousProps: Props, previousState: State): void;
  componentWillUnmount?(): void;
  componentDidCatch?(error: Error, info: { componentStack?: string }): void;
  static getDerivedStateFromError?(error: Error): Partial<any> | null;

  /**
   * Updates component state and schedules a reactive re-render frame.
   */
  setState(newState: Partial<State>): void {
    if (this._updater) {
      this._updater.enqueueSetState(this, newState);
      return;
    }
    this.state = { ...this.state, ...newState };
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  /**
   * Explicitly marks component as dirty to force redraw.
   */
  markDirty(): void {
    this._dirty = true;
    if (this.engine) {
      this.engine.requestFrame();
    }
  }

  _cachedCursor: { logicalLineIndex: number; characterOffsetWithinLine: number } | null = null;

  /**
   * Returns lines array, using cache if clean and width matches.
   */
  _getLines(width?: number, forceRedraw = false): string[] {
    if (this._dirty || forceRedraw || (width !== undefined && width !== this._lastWidth)) {
      const result = this.renderWithCursor(width);
      this._cachedLines = result.lines;
      this._cachedCursor = result.cursor ?? null;
      this._lastWidth = width;
      this._dirty = false;
    }
    return this._cachedLines;
  }

  getLines(width?: number, forceRedraw = false): string[] {
    return this._getLines(width, forceRedraw);
  }

  /**
   * Return { logicalLineIndex, characterOffsetWithinLine } for cursor placement.
   * Derived directly from single-pass renderWithCursor().
   */
  getLogicalCursor(): { logicalLineIndex: number; characterOffsetWithinLine: number } | null {
    if (this._dirty) {
      this._getLines(this._lastWidth);
    }
    return this._cachedCursor;
  }

  /** Lifecycle hooks */
  onMount(): void {
    if (typeof this.componentDidMount === 'function') {
      this.componentDidMount();
    }
  }

  onUnmount(): void {
    if (typeof this.componentWillUnmount === 'function') {
      this.componentWillUnmount();
    }
    this.engine = null;
  }

  onResize(_newWidth: number, _newHeight: number): void {
    this.markDirty();
  }

  /**
   * Single-pass render method that produces both lines and cursor position.
   */
  renderWithCursor(width?: number): {
    lines: string[];
    cursor?: { logicalLineIndex: number; characterOffsetWithinLine: number } | null;
  } {
    const output = this.render(width);
    if (Array.isArray(output) && (output.length === 0 || typeof output[0] === 'string')) {
      return {
        lines: output as string[],
        cursor: null,
      };
    }
    return {
      lines: [],
      cursor: null,
    };
  }

  render(_width?: number): any {
    return [];
  }
}

export default Component;
