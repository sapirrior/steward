import { Component, type InputEvent } from 'stitchable';
import { c } from '../../theme/index.js';
import { renderModalBox } from './modal-box.js';

export interface SelectListOptions<T> {
  items: T[];
  title: string;
  subtitle?: string;
  placeholder?: string;
  emptyMessage?: string;
  maxVisible?: number;
  searchFilter?: (item: T, query: string) => boolean;
  onSelect: (item: T) => void;
  onCancel: () => void;
  renderItem: (item: T, isSelected: boolean, maxCols: number) => any;
}

export interface SelectListState {
  query: string;
  selectedIndex: number;
}

/**
 * Generic keyboard-driven selection dock.
 */
export class SelectList<T> extends Component<SelectListOptions<T>, SelectListState> {
  override wrap = false;
  override clip = true;
  override ellipsis = false;

  private removeInputListener: (() => void) | null = null;

  constructor(options: SelectListOptions<T>) {
    super(options);
    this.state = {
      query: '',
      selectedIndex: 0,
    };
  }

  override componentDidMount(): void {
    if (!this.engine) return;

    this.removeInputListener = this.engine.addInputListener((ev: InputEvent) => {
      if (ev.key.escape) {
        this.props.onCancel();
        return true;
      }

      const filtered = this.getFilteredItems();

      if (ev.key.upArrow) {
        if (filtered.length > 0) {
          this.setState({
            selectedIndex:
              this.state.selectedIndex > 0 ? this.state.selectedIndex - 1 : filtered.length - 1,
          });
        }
        return true;
      }

      if (ev.key.downArrow) {
        if (filtered.length > 0) {
          this.setState({
            selectedIndex:
              this.state.selectedIndex < filtered.length - 1 ? this.state.selectedIndex + 1 : 0,
          });
        }
        return true;
      }

      if (ev.key.return) {
        const chosen = filtered[this.state.selectedIndex];
        if (chosen) this.props.onSelect(chosen);
        return true;
      }

      if (ev.key.backspace) {
        if (this.state.query.length > 0) {
          this.setState({ query: this.state.query.slice(0, -1), selectedIndex: 0 });
        }
        return true;
      }

      if (ev.input && ev.input.length === 1 && ev.input >= ' ') {
        this.setState({ query: this.state.query + ev.input, selectedIndex: 0 });
        return true;
      }

      return false;
    });
  }

  override componentWillUnmount(): void {
    if (this.removeInputListener) {
      this.removeInputListener();
      this.removeInputListener = null;
    }
  }

  private getFilteredItems(): T[] {
    const q = this.state.query.trim().toLowerCase();
    if (!q) return this.props.items;
    if (this.props.searchFilter) {
      return this.props.items.filter((item) => this.props.searchFilter!(item, q));
    }
    return this.props.items;
  }

  override render(width?: number): string[] {
    const termWidth = width ?? process.stdout.columns ?? 80;
    const maxCols = Math.max(1, termWidth);
    const filtered = this.getFilteredItems();
    const maxVisible = this.props.maxVisible ?? 4;

    const startIdx = Math.max(
      0,
      Math.min(
        this.state.selectedIndex - Math.floor(maxVisible / 2),
        Math.max(0, filtered.length - maxVisible),
      ),
    );
    const visibleItems = filtered.slice(startIdx, startIdx + maxVisible);

    const content: any[] = [];
    if (filtered.length === 0) {
      content.push(this.props.emptyMessage ?? '  No matching items.');
    } else {
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i]!;
        const actualIdx = startIdx + i;
        const isSelected = actualIdx === this.state.selectedIndex;
        const rendered = this.props.renderItem(item, isSelected, maxCols);
        content.push(rendered);
      }
    }

    const searchPrompt = `> ${this.state.query ? c.text(this.state.query) : c.muted(this.props.placeholder ?? 'Type to filter…')}`;

    return renderModalBox({
      title: this.props.title,
      subtitle: this.props.subtitle,
      searchLine: searchPrompt,
      content,
      footer: `↑/↓ navigate · Enter select · Esc cancel  (${filtered.length} available)`,
      width: termWidth,
    });
  }
}
