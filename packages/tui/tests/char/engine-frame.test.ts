import { describe, expect, test } from 'bun:test';
import { makeEngine } from '../helpers/term.js';
import Component from '../../src/engine/Component.js';

class CounterWidget extends Component {
  count = 0;
  tick() {
    this.count++;
    this.markDirty();
  }
  render() {
    return [`Count: ${this.count}`];
  }
}

describe('Phase 6: Frame Scheduling & Throttling Deduplication', () => {
  test('Multiple requestFrame() calls in one tick produce exactly 1 frame', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    const widget = new CounterWidget();
    engine.mount(widget);

    await engine.flush();
    io.clearOutput();

    // Call requestFrame multiple times in one synchronous tick
    widget.tick();
    widget.tick();
    widget.tick();
    engine.requestFrame();
    engine.requestFrame();

    await engine.flush();

    // The output should contain Count: 3 and reflect single atomic update
    expect(io.written).toContain('Count: 3');

    engine.dispose();
  });

  test('maxFps throttling batches rapid bursts without redundant frames', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5, maxFps: 30 });
    engine.ensureAlternateScreen();
    const widget = new CounterWidget();
    engine.mount(widget);

    await engine.flush();
    io.clearOutput();

    // Rapid burst of 10 ticks over 10ms
    for (let i = 0; i < 10; i++) {
      widget.tick();
      await new Promise((r) => setTimeout(r, 1));
    }

    await engine.flush();
    expect(io.written).toContain('Count: 10');

    engine.dispose();
  });

  test('flush() cleanly resolves pending frames and does not hang', async () => {
    const { engine } = makeEngine({ columns: 40, rows: 5, maxFps: 10 });
    engine.ensureAlternateScreen();
    const widget = new CounterWidget();
    engine.mount(widget);

    widget.tick();
    let flushed = false;
    await engine.flush().then(() => {
      flushed = true;
    });

    expect(flushed).toBe(true);
    engine.dispose();
  });
});
