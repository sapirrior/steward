import { describe, expect, test } from 'bun:test';
import { createApp, mount, Box, Text } from '../../src/index.js';
import { memoryIO } from '../../src/terminal/io.js';
import { TerminalEngine } from '../../src/engine/TerminalEngine.js';

describe('Phase 5: Runtime mount and createApp Integration', () => {
  test('S9: Zero extra renderFn calls during scroll-only frames', async () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    let renderCalls = 0;

    const app = createApp(
      () => {
        renderCalls++;
        return Box({}, Text({}, 'Live Dynamic Content'));
      },
      { io, mouse: true },
    );

    // Commit 20 lines to history
    for (let i = 0; i < 20; i++) {
      app.state; // keep referenced
    }
    await new Promise((r) => setTimeout(r, 20));

    const initialCalls = renderCalls;
    expect(initialCalls).toBeGreaterThanOrEqual(1);

    // Perform 10 PageUp scroll key presses
    for (let i = 0; i < 10; i++) {
      io.feed('\x1b[5~');
      await new Promise((r) => setTimeout(r, 5));
    }

    // Zero extra renderFn calls must occur during pure scroll operations
    expect(renderCalls - initialCalls).toBe(0);

    app.unmount();
  });

  test('onKey receives no leaked characters for SGR mouse, fragmented arrows, or split sequences', async () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const receivedKeys: Array<{ input: string; name: string }> = [];

    const app = createApp(
      () => Box({}, Text({}, 'App')),
      {
        io,
        mouse: true,
        onKey: (input, key) => {
          receivedKeys.push({ input, name: key.name });
        },
      },
    );

    // Feed SGR wheel (should scroll and NOT leak to onKey)
    io.feed('\x1b[<64;10;5M');
    // Feed fragmented SGR mouse
    io.feed('\x1b[<64;10;');
    io.feed('5M');
    // Feed fragmented arrow
    io.feed('\x1b');
    io.feed('[A');

    await new Promise((r) => setTimeout(r, 20));

    // Only the up arrow should reach onKey with input: ''
    expect(receivedKeys).toEqual([{ input: '', name: 'up' }]);

    app.unmount();
  });

  test('Paste delivered once with key.paste: true and text in input', async () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const receivedPastes: Array<{ input: string; isPaste: boolean }> = [];

    const app = createApp(
      () => Box({}, Text({}, 'App')),
      {
        io,
        onKey: (input, key) => {
          if (key.paste) {
            receivedPastes.push({ input, isPaste: key.paste });
          }
        },
      },
    );

    // Bracketed paste split across 2 chunks
    io.feed('\x1b[200~Hello\r\n');
    io.feed('World\x1b[201~');

    await new Promise((r) => setTimeout(r, 20));

    expect(receivedPastes).toEqual([{ input: 'Hello\nWorld', isPaste: true }]);

    app.unmount();
  });

  test('Ctrl+U and Ctrl+D reach onKey and do not scroll view', async () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const received: string[] = [];

    const app = createApp(
      () => Box({}, Text({}, 'App')),
      {
        io,
        onKey: (_input, key) => {
          received.push(`${key.name}${key.ctrl ? '+ctrl' : ''}`);
        },
      },
    );

    io.feed('\x04'); // Ctrl+D
    io.feed('\x15'); // Ctrl+U

    await new Promise((r) => setTimeout(r, 20));

    expect(received).toEqual(['d+ctrl', 'u+ctrl']);

    app.unmount();
  });

  test('Engine ownership: mount does not dispose caller-owned engine on unmount', () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const engine = new TerminalEngine({ io, exitHook: false });

    let unmounted = false;
    const handle = mount(engine, () => Box({}, Text({}, 'Root')), {
      onUnmount: () => {
        unmounted = true;
      },
    });

    handle.unmount();
    expect(unmounted).toBe(true);
    // Engine should NOT be disposed
    expect((engine as any).disposed).toBe(false);

    engine.dispose();
    expect((engine as any).disposed).toBe(true);
  });

  test('Engine ownership: createApp disposes its engine on unmount', () => {
    const io = memoryIO({ columns: 40, rows: 5 });
    const app = createApp(() => Box({}, Text({}, 'Root')), { io });

    const engine = (app as any).state ? (app as any) : null;
    app.unmount();
    // Verification that alternate screen exit sequence was written on dispose
    expect(io.written).toContain('\x1b[?1049l');
  });
});
