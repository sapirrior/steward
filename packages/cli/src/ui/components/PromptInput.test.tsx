/**
 * @file PromptInput.test.tsx
 */

import { describe, it, expect } from 'bun:test';
import { PromptInput } from './PromptInput.js';
import { render, memoryIO } from 'stitchable';

describe('PromptInput', () => {
  it('submits on Enter and resets input', async () => {
    let submitted = '';
    let submittedMode = '';
    const io = memoryIO({ columns: 80, rows: 24 });

    const handle = render(
      <PromptInput
        onSubmit={(val, mode) => {
          submitted = val;
          submittedMode = mode;
        }}
      />,
      { io },
    );
    await handle.engine.flush();

    // Type "hello"
    io.feed('hello');
    await handle.engine.flush();

    // Press Enter (\r)
    io.feed('\r');
    await handle.engine.flush();

    expect(submitted).toBe('hello');
    expect(submittedMode).toBe('prompt');
  });

  it('inserts newline when pressing \\ and Enter', async () => {
    let submitted = '';
    const io = memoryIO({ columns: 80, rows: 24 });

    const handle = render(
      <PromptInput
        onSubmit={(val) => {
          submitted = val;
        }}
      />,
      { io },
    );
    await handle.engine.flush();

    // Type "line1\" then Enter then "line2" then Enter
    io.feed('line1\\');
    await handle.engine.flush();

    io.feed('\r');
    await handle.engine.flush();

    // Now type "line2" and Enter
    io.feed('line2');
    await handle.engine.flush();

    io.feed('\r');
    await handle.engine.flush();

    expect(submitted).toBe('line1\nline2');
  });

  it('clears input on double Esc', async () => {
    let submitted = '';
    const io = memoryIO({ columns: 80, rows: 24 });

    const handle = render(
      <PromptInput
        onSubmit={(val) => {
          submitted = val;
        }}
      />,
      { io },
    );
    await handle.engine.flush();

    // Type text
    io.feed('some text');
    await handle.engine.flush();

    // Double Esc within 600ms
    io.feed('\x1b');
    await handle.engine.flush();
    io.feed('\x1b');
    await handle.engine.flush();

    // Press Enter: should submit nothing because it was cleared
    io.feed('\r');
    await handle.engine.flush();

    expect(submitted).toBe('');
  });
});
