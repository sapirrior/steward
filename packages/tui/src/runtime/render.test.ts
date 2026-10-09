import { describe, it, expect } from 'bun:test';
import { memoryIO } from '../terminal/io.js';
import { render } from './render.js';
import { jsx } from '../reconciler/element.js';
import { useState } from '../reconciler/hooks.js';
import { useInput } from './AppContext.js';

describe('render(<App />) Public API (Phase 7)', () => {
  it('mounts, renders, and responds to useInput', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });

    function CounterApp() {
      const [count, setCount] = useState(0);

      useInput((ev) => {
        if (ev.type === 'key' && ev.key.name === 'up') {
          setCount((c) => c + 1);
          return true;
        }
      });

      return jsx('text', { children: `Count: ${count}` });
    }

    const handle = render(jsx(CounterApp, {}), { io });
    await handle.engine.flush();

    expect(handle.engine.inAlternateScreen).toBe(true);

    // Press up arrow
    io.feed('\x1b[A');
    await handle.engine.flush();

    handle.unmount();
    expect(handle.engine.inAlternateScreen).toBe(false);
  });

  it('resolves waitUntilExit when exit is called', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });

    function SimpleApp() {
      return jsx('text', { children: 'Hello World' });
    }

    const handle = render(jsx(SimpleApp, {}), { io });
    await handle.engine.flush();

    let exited = false;
    handle.waitUntilExit().then(() => {
      exited = true;
    });

    handle.exit();
    await new Promise((r) => setTimeout(r, 10));

    expect(exited).toBe(true);
  });
});
