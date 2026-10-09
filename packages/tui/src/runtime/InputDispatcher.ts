import type { InputEvent } from '../terminal/input.js';

export interface InputHandlerRecord {
  handler: (event: InputEvent) => boolean | void;
  whenFocused?: boolean;
  isFocused?: () => boolean;
}

export class InputDispatcher {
  private handlers: InputHandlerRecord[] = [];
  private activeFocusId: string | null = null;
  private focusListeners = new Set<(id: string | null) => void>();

  register(record: InputHandlerRecord): () => void {
    this.handlers.push(record);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== record);
    };
  }

  dispatch(event: InputEvent): boolean {
    // Deliver in reverse registration order (innermost / newest first)
    for (let i = this.handlers.length - 1; i >= 0; i--) {
      const item = this.handlers[i];
      if (item.whenFocused) {
        if (item.isFocused && !item.isFocused()) {
          continue;
        }
      }
      const consumed = item.handler(event);
      if (consumed === true) {
        return true;
      }
    }
    return false;
  }

  getFocus(): string | null {
    return this.activeFocusId;
  }

  setFocus(id: string | null): void {
    if (this.activeFocusId !== id) {
      this.activeFocusId = id;
      for (const listener of this.focusListeners) {
        listener(id);
      }
    }
  }

  onFocusChange(listener: (id: string | null) => void): () => void {
    this.focusListeners.add(listener);
    return () => {
      this.focusListeners.delete(listener);
    };
  }
}
