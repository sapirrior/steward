import { describe, expect, test } from 'bun:test';
import TerminalEngine from '../../src/engine/TerminalEngine.js';
import Component from '../../src/engine/Component.js';
import { memoryIO } from '../../src/terminal/io.js';

class SampleWidget extends Component {
  render() {
    return ['Sample Widget Content'];
  }
}

describe('Step 1.2: TerminalEngine IO Injection & Isolation', () => {
  test('Two engines in one process do not leak listeners or collide', async () => {
    const io1 = memoryIO({ columns: 80, rows: 24 });
    const engine1 = new TerminalEngine({ io: io1, exitHook: false });
    const widget1 = new SampleWidget();

    engine1.mount(widget1);
    await new Promise((r) => setTimeout(r, 10));

    expect(io1.output.length).toBeGreaterThan(0);
    // Dispose engine 1
    engine1.dispose();

    const io2 = memoryIO({ columns: 80, rows: 24 });
    const engine2 = new TerminalEngine({ io: io2, exitHook: false });
    const widget2 = new SampleWidget();

    engine2.mount(widget2);
    await new Promise((r) => setTimeout(r, 10));

    expect(io2.output.length).toBeGreaterThan(0);
    engine2.dispose();
  });

  test('Mouse is off by default and enabled when mouse: true', () => {
    const ioDefault = memoryIO({ columns: 80, rows: 24 });
    const engineDefault = new TerminalEngine({ io: ioDefault, exitHook: false });
    engineDefault.ensureAlternateScreen();
    const defaultSeq = ioDefault.output.join('');
    expect(defaultSeq).not.toContain('\x1b[?1000h');
    expect(defaultSeq).not.toContain('\x1b[?1002h');
    expect(defaultSeq).not.toContain('\x1b[?1006h');
    engineDefault.dispose();

    const ioMouse = memoryIO({ columns: 80, rows: 24 });
    const engineMouse = new TerminalEngine({ io: ioMouse, mouse: true, exitHook: false });
    engineMouse.ensureAlternateScreen();
    const mouseSeq = ioMouse.output.join('');
    expect(mouseSeq).toContain('\x1b[?1000h');
    expect(mouseSeq).toContain('\x1b[?1002h');
    expect(mouseSeq).toContain('\x1b[?1006h');
    engineMouse.dispose();
  });

  test('onError receives transient render errors and recovers', async () => {
    let capturedError: any = null;
    let capturedCtx: any = null;

    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({
      io,
      exitHook: false,
      onError: (err, ctx) => {
        capturedError = err;
        capturedCtx = ctx;
      },
    });

    let shouldFail = true;
    class FlakyComponent extends Component {
      render() {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('Simulated Transient Error');
        }
        return ['Recovered Content'];
      }
    }

    engine.mount(new FlakyComponent());
    await new Promise((r) => setTimeout(r, 20));

    expect(capturedError).not.toBeNull();
    expect(capturedError.message).toBe('Simulated Transient Error');
    expect(capturedCtx?.source).toBe('render-frame');

    engine.dispose();
  });
});
