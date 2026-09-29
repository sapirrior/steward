import { describe, expect, test } from 'bun:test';
import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';
import { assertRowWidth } from '../../src/engine/cell-layout.js';
import TerminalEngine from '../../src/engine/TerminalEngine.js';
import Component from '../../src/engine/Component.js';
import { memoryIO } from '../../src/terminal/io.js';

describe('Step 1.4: onOverflow callback and no file-writing debug', () => {
  test('assertRowWidth triggers onOverflow callback on exceeding maxCols', () => {
    let overflowInfo: any = null;
    const longLine = '123456789012345'; // length 15
    const result = assertRowWidth(longLine, 10, (info) => {
      overflowInfo = info;
    });

    expect(overflowInfo).not.toBeNull();
    expect(overflowInfo.width).toBe(15);
    expect(overflowInfo.maxCols).toBe(10);
    expect(overflowInfo.row).toBe(longLine);
    expect(stringWidth(stripAnsi(result))).toBeLessThanOrEqual(10);
  });

  test('TerminalEngine options.onOverflow receives layout overflow notifications', async () => {
    const overflows: any[] = [];
    const io = memoryIO({ columns: 10, rows: 5 });
    const engine = new TerminalEngine({
      io,
      exitHook: false,
      onOverflow: (info) => {
        overflows.push(info);
      },
    });

    class WideComponent extends Component {
      wrap = false;
      clip = false;
      render() {
        return ['Very long unwrapped and unclipped line that exceeds screen width'];
      }
    }

    engine.mount(new WideComponent());
    await new Promise((r) => setTimeout(r, 20));

    expect(overflows.length).toBeGreaterThan(0);
    expect(overflows[0].maxCols).toBe(20); // safeWidth min is 20 in frameBuffer for now
    engine.dispose();
  });
});
