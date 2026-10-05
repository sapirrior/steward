import { describe, it, expect } from 'bun:test';
import FilePermissionDock from '../../src/interface/components/docks/FilePermissionDock.js';
import type { FilePermissionRequest } from '@steward/agent';
import { makeEngine } from '../helpers/app.js';

describe('FilePermissionDock Interaction & State Machine (Section 28)', () => {
  it('defaults to Yes selection, toggles with Up/Down and numeric keys 1/2, submits on Enter', () => {
    let decision: any = null;
    const request: FilePermissionRequest = {
      kind: 'create',
      filePath: 'src/components/Header.tsx',
      before: null,
      after: 'export function Header() { return null; }',
    };

    const dock = new FilePermissionDock({
      request,
      onDecision: (allowed) => {
        decision = allowed;
      },
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);

    expect(dock.state.selectedIndex).toBe(0); // Yes

    // Down arrow -> select No
    io.feed('\x1b[B');
    expect(dock.state.selectedIndex).toBe(1); // No

    // Up arrow -> select Yes
    io.feed('\x1b[A');
    expect(dock.state.selectedIndex).toBe(0); // Yes

    // Direct numeric 2 -> select No
    io.feed('2');
    expect(dock.state.selectedIndex).toBe(1); // No

    // Direct numeric 1 -> select Yes
    io.feed('1');
    expect(dock.state.selectedIndex).toBe(0); // Yes

    // Submit with Enter
    io.feed('\r');
    expect(decision).toBe(true);

    engine.dispose();
  });

  it('submits allowed=false when Enter is pressed on No selection', () => {
    let decision: any = null;
    const dock = new FilePermissionDock({
      request: {
        kind: 'overwrite',
        filePath: 'config.json',
        before: '{}',
        after: '{"updated": true}',
      },
      onDecision: (allowed) => {
        decision = allowed;
      },
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);

    // Select No
    io.feed('2');
    expect(dock.state.selectedIndex).toBe(1);

    // Enter
    io.feed('\r');
    expect(decision).toBe(false);

    engine.dispose();
  });

  it('cancels/denies on Esc key in normal mode', () => {
    let decision: any = null;
    const dock = new FilePermissionDock({
      request: {
        kind: 'edit',
        filePath: 'src/main.ts',
        before: 'const a = 1;',
        after: 'const a = 2;',
      },
      onDecision: (allowed) => {
        decision = allowed;
      },
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);

    io.feed('\x1b');
    engine.flushInput();
    expect(decision).toBe(false);

    engine.dispose();
  });

  it('transitions to review mode on f/F and toggles back on f/F or Esc', () => {
    const dock = new FilePermissionDock({
      request: {
        kind: 'edit',
        filePath: 'src/main.ts',
        before: 'const a = 1;',
        after: 'const a = 2;',
      },
      onDecision: () => {},
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);

    expect(dock.state.mode).toBe('NORMAL');

    // Press 'f' -> enter review mode
    io.feed('f');
    expect(dock.state.mode).toBe('REVIEW');

    // Press 'f' again -> return to normal mode
    io.feed('f');
    expect(dock.state.mode).toBe('NORMAL');

    // Press 'F' -> enter review mode
    io.feed('F');
    expect(dock.state.mode).toBe('REVIEW');

    // Press Esc in review mode -> return to normal mode without deciding
    io.feed('\x1b');
    engine.flushInput();
    expect(dock.state.mode).toBe('NORMAL');

    engine.dispose();
  });

  it('supports scrolling with Up/Down in review mode', () => {
    const longContent = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join('\n');
    const dock = new FilePermissionDock({
      request: {
        kind: 'create',
        filePath: 'long.txt',
        before: null,
        after: longContent,
      },
      onDecision: () => {},
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);

    io.feed('f');
    expect(dock.state.mode).toBe('REVIEW');
    expect(dock.state.scrollOffset).toBe(0);

    // Down arrow scrolls
    io.feed('\x1b[B');
    expect(dock.state.scrollOffset).toBe(1);

    // Up arrow scrolls back
    io.feed('\x1b[A');
    expect(dock.state.scrollOffset).toBe(0);

    // Up arrow at top does not go below 0
    io.feed('\x1b[A');
    expect(dock.state.scrollOffset).toBe(0);

    engine.dispose();
  });

  it('cleans up listener on unmount so subsequent inputs do not trigger decisions', () => {
    let decisionCount = 0;
    const dock = new FilePermissionDock({
      request: {
        kind: 'create',
        filePath: 'test.txt',
        before: null,
        after: 'content',
      },
      onDecision: () => {
        decisionCount++;
      },
    });

    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();
    engine.mount(dock);
    engine.unmount(dock);

    // Inject input after unmount
    io.feed('\r');
    io.feed('\x1b');
    engine.flushInput();
    expect(decisionCount).toBe(0);

    engine.dispose();
  });
});
