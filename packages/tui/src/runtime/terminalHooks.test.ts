import { describe, expect, it } from 'bun:test';
import { jsx } from '../reconciler/element.js';
import { AppRoot } from './AppRoot.js';
import { useInput, useFocus, useTerminalSize, useCursor, useApp } from '../hooks/index.js';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import { memoryIO } from '../terminal/io.js';
import { makeKey } from '../terminal/input.js';

describe('Terminal-Aware Hooks (Phase 5)', () => {
  it('dispatches key and bracketed paste events via useInput', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    const receivedEvents: string[] = [];

    const InputApp = () => {
      useInput((ev) => {
        if (ev.type === 'key') {
          receivedEvents.push(`key:${ev.key.name}`);
        } else if (ev.type === 'paste') {
          receivedEvents.push(`paste:${ev.text}`);
        }
      });
      return jsx('text', { children: 'Running' });
    };

    const root = new AppRoot(jsx(InputApp, {}), { engine });
    await engine.flush();

    // Feed key
    io.feed('a');
    expect(receivedEvents).toEqual(['key:a']);

    // Feed bracketed paste
    io.feed('\x1b[200~pasted text\x1b[201~');
    expect(receivedEvents).toEqual(['key:a', 'paste:pasted text']);

    root.unmount();
  });

  it('manages logical focus and filters focused useInput handlers', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    const log: string[] = [];

    let focusItemA: any;
    let focusItemB: any;

    const FocusableItem = (props: { id: string; autoFocus?: boolean }) => {
      const { isFocused, focus } = useFocus({
        id: props.id,
        autoFocus: props.autoFocus,
      });
      if (props.id === 'item-a') focusItemA = focus;
      if (props.id === 'item-b') focusItemB = focus;

      useInput(
        (ev) => {
          if (ev.type === 'key') {
            log.push(`${props.id}:${ev.key.name}`);
          }
        },
        { whenFocused: true },
      );

      return jsx('text', {
        children: `${props.id}:${isFocused ? 'FOCUSED' : 'BLURRED'}`,
      });
    };

    const App = () => {
      return jsx('box', {
        children: [
          jsx(FocusableItem, { id: 'item-a', autoFocus: true }),
          jsx(FocusableItem, { id: 'item-b' }),
        ],
      });
    };

    const root = new AppRoot(jsx(App, {}), { engine });
    await engine.flush();

    // item-a holds autofocus
    io.feed('x');
    expect(log).toEqual(['item-a:x']);

    // Shift focus to item-b
    focusItemB();
    root.render();
    await engine.flush();

    io.feed('y');
    expect(log).toEqual(['item-a:x', 'item-b:y']);

    root.unmount();
  });

  it('updates useTerminalSize on engine resize', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    let capturedCols = 0;
    let capturedRows = 0;

    const SizeApp = () => {
      const size = useTerminalSize();
      capturedCols = size.columns;
      capturedRows = size.rows;
      return jsx('text', { children: `${size.columns}x${size.rows}` });
    };

    const root = new AppRoot(jsx(SizeApp, {}), { engine });
    await engine.flush();
    expect(capturedCols).toBe(80);
    expect(capturedRows).toBe(24);

    // Trigger resize
    io.resize(120, 40);
    root.render();
    await engine.flush();

    expect(capturedCols).toBe(120);
    expect(capturedRows).toBe(40);

    root.unmount();
  });

  it('emits logical cursor in single-pass renderWithCursor via useCursor', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });

    const CursorApp = () => {
      useCursor({ line: 1, characterOffset: 5 });
      return jsx('box', {
        children: [
          jsx('text', { children: 'Line 0' }),
          jsx('text', { children: 'Line 1 with cursor' }),
        ],
      });
    };

    const root = new AppRoot(jsx(CursorApp, {}), { engine });
    const comp = (root as any).rootComponent;
    const result = comp.renderWithCursor(80);

    expect(result.cursor).toEqual({
      logicalLineIndex: 1,
      characterOffsetWithinLine: 5,
    });

    root.unmount();
  });
});
