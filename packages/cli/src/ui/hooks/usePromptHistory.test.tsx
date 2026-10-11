import { describe, it, expect } from 'bun:test';
import { usePromptHistory } from './usePromptHistory.js';
import { render, memoryIO, Box } from 'stitchable';

describe('usePromptHistory', () => {
  it('adds entries to history and navigates with draft preservation', async () => {
    let api: any = null;
    const io = memoryIO({ columns: 80, rows: 24 });

    function TestApp() {
      api = usePromptHistory({ initialHistory: ['first', 'second'] });
      return <Box />;
    }

    const handle = render(<TestApp />, { io });
    await handle.engine.flush();

    expect(api.history).toEqual(['first', 'second']);

    // Up: gets 'second', saves draft
    let val = api.navigateUp('active draft');
    expect(val).toBe('second');

    // Up again: gets 'first'
    val = api.navigateUp('active draft');
    expect(val).toBe('first');

    // Down: gets 'second'
    val = api.navigateDown();
    expect(val).toBe('second');

    // Down again: restores draft
    val = api.navigateDown();
    expect(val).toBe('active draft');

    // Add new history entry
    api.addHistory('third');
    await handle.engine.flush();
    expect(api.history).toEqual(['first', 'second', 'third']);
  });
});
