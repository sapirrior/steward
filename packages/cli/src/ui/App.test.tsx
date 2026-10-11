/**
 * @file App.test.tsx
 */

import { describe, it, expect } from 'bun:test';
import { App } from './App.js';
import { render, memoryIO } from 'stitchable';

describe('App TUI', () => {
  it('renders Header and executes bash commands in scrollback', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });

    const handle = render(
      <App
        version="0.38.0"
        provider="google"
        model="gemini-flash"
        cwd="/test/dir"
      />,
      { io },
    );
    await handle.engine.flush();

    // Type bash command "!echo steward_test"
    io.feed('!echo steward_test\r');
    await handle.engine.flush();

    // Give asynchronous execution a moment
    await new Promise((res) => setTimeout(res, 100));
    await handle.engine.flush();

    // Check that engine inAlternateScreen is true
    expect(handle.engine.inAlternateScreen).toBe(true);
  });
});
