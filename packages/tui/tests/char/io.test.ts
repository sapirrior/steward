import { describe, expect, test } from 'bun:test';
import { EventEmitter } from 'node:events';
import { nodeIO, memoryIO } from '../../src/terminal/io.js';
import TerminalEngine from '../../src/engine/TerminalEngine.js';

class FakeStdin extends EventEmitter {
  isTTY = true;
  setRawMode(_on: boolean) {}
  resume() {}
  pause() {}
  unref() {}
}

class FakeStdout extends EventEmitter {
  isTTY = true;
  columns = 80;
  rows = 24;
  output: string[] = [];
  write(chunk: string) {
    this.output.push(chunk);
    return true;
  }
}

describe('Terminal IO multibyte streaming and sequence integrity', () => {
  test('nodeIO decodes split multibyte UTF-8 characters across chunks without corruption', () => {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    const io = nodeIO({ stdin: stdin as any, stdout: stdout as any });

    const received: string[] = [];
    const unsubscribe = io.input.onData((chunk) => {
      received.push(chunk);
    });

    // Euro symbol: 3 bytes [0xE2, 0x82, 0xAC]
    const euroBuf = Buffer.from('€', 'utf8');
    stdin.emit('data', euroBuf.subarray(0, 1));
    stdin.emit('data', euroBuf.subarray(1));

    expect(received.join('')).toBe('€');
    unsubscribe();
  });

  test('nodeIO decodes 4-byte emoji split at all possible byte boundaries', () => {
    const emoji = '🚀'; // 4 bytes [0xF0, 0x9F, 0x99, 0x80]
    const emojiBuf = Buffer.from(emoji, 'utf8');

    for (let splitPoint = 1; splitPoint < emojiBuf.length; splitPoint++) {
      const stdin = new FakeStdin();
      const stdout = new FakeStdout();
      const io = nodeIO({ stdin: stdin as any, stdout: stdout as any });

      const received: string[] = [];
      const unsubscribe = io.input.onData((chunk) => {
        received.push(chunk);
      });

      stdin.emit('data', emojiBuf.subarray(0, splitPoint));
      stdin.emit('data', emojiBuf.subarray(splitPoint));

      expect(received.join('')).toBe(emoji);
      unsubscribe();
    }
  });

  test('Bracketed paste and mouse modes sequence order on enter, exit, and dispose', async () => {
    const io = memoryIO({ columns: 80, rows: 24 });
    const engine = new TerminalEngine({ io, mouse: true, exitHook: false });

    engine.ensureAlternateScreen();
    const enterOutput = io.written;

    // Must enable bracketed paste (?2004h) and SGR mouse (?1000h, ?1006h)
    expect(enterOutput).toContain('\x1b[?2004h');
    expect(enterOutput).toContain('\x1b[?1000h');
    expect(enterOutput).toContain('\x1b[?1006h');
    expect(enterOutput).not.toContain('\x1b[?1002h');

    io.clearOutput();
    await engine.exitAlternateScreen();
    const exitOutput = io.written;

    // Must disable mouse and bracketed paste before exiting alternate screen (?1049l)
    expect(exitOutput).toContain('\x1b[?1006l\x1b[?1000l');
    expect(exitOutput).toContain('\x1b[?2004l');
    expect(exitOutput).toContain('\x1b[?1049l');

    const mouseIndex = exitOutput.indexOf('\x1b[?1006l');
    const pasteIndex = exitOutput.indexOf('\x1b[?2004l');
    const altScreenExitIndex = exitOutput.indexOf('\x1b[?1049l');

    expect(mouseIndex).toBeLessThan(altScreenExitIndex);
    expect(pasteIndex).toBeLessThan(altScreenExitIndex);

    engine.dispose();
  });
});
