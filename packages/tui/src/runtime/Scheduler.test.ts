import { describe, expect, it } from 'bun:test';
import { TerminalEngine } from '../engine/TerminalEngine.js';
import { memoryIO } from '../terminal/io.js';
import { AppScheduler } from './AppScheduler.js';

describe('AppScheduler and Engine Batching (Phase 3)', () => {
  it('coalesces multiple state updates into a single batch', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    let renderCount = 0;

    const scheduler = new AppScheduler(engine, () => {
      renderCount++;
    });

    // Rapid synchronous scheduling
    scheduler.scheduleUpdate();
    scheduler.scheduleUpdate();
    scheduler.scheduleUpdate();

    expect(renderCount).toBe(0);

    // Wait for microtask coalescing
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(renderCount).toBe(1);
  });

  it('runs post-frame callbacks only after successful frame write', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io });
    let postFrameRan = false;

    engine.afterNextFrame(() => {
      postFrameRan = true;
    });

    expect(postFrameRan).toBe(false);

    engine.ensureAlternateScreen();
    engine.requestFrame();
    await engine.flush();

    expect(postFrameRan).toBe(true);
  });
});
