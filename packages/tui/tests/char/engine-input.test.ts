import { describe, expect, test } from 'bun:test';
import { makeEngine } from '../helpers/term.js';
import Component from '../../src/engine/Component.js';
import type { InputEvent } from '../../src/terminal/input.js';

class LiveComp extends Component {
  render() {
    return ['> prompt line'];
  }
}

describe('Phase 4: Engine Input Dispatch and Scroll Bindings', () => {
  test('PageUp and PageDown scroll rows - 1 rows; coalesced and fragmented work', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 6 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 20; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    // rows = 6 -> page step is 6 - 1 = 5
    // 1. Single PageUp \x1b[5~
    io.feed('\x1b[5~');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(5);

    // 2. Coalesced PageUp x2 \x1b[5~\x1b[5~ -> moves 2 * 5 = 10 rows (total offset 15)
    io.feed('\x1b[5~\x1b[5~');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(15);

    // 3. Fragmented PageDown \x1b[6 and ~ -> moves -5 rows
    io.feed('\x1b[6');
    io.feed('~');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(10);

    // 4. Shift+PageUp \x1b[5;2~
    io.feed('\x1b[5;2~');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(15);

    engine.dispose();
  });

  test('Ctrl+Home / Shift+Home go to top, Ctrl+End / Shift+End go to bottom', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 15; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    // Ctrl+Home \x1b[1;5H -> top (max offset 11)
    io.feed('\x1b[1;5H');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(11);

    // Ctrl+End \x1b[1;5F -> bottom (offset 0)
    io.feed('\x1b[1;5F');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(0);

    engine.dispose();
  });

  test('Plain Home, End, Ctrl+U, and Ctrl+D do NOT scroll and ARE delivered to listeners', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 15; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    const received: string[] = [];
    engine.addInputListener((ev) => {
      if (ev.type === 'key') {
        received.push(`${ev.key.name}${ev.key.ctrl ? '+ctrl' : ''}`);
      }
    });

    // Plain Home \x1b[H
    io.feed('\x1b[H');
    // Plain End \x1b[F
    io.feed('\x1b[F');
    // Ctrl+D \x04
    io.feed('\x04');
    // Ctrl+U \x15
    io.feed('\x15');
    await engine.flush();

    // Scroll state remains at bottom (0)
    expect(engine.getScrollState().offset).toBe(0);
    expect(received).toEqual(['home', 'end', 'd+ctrl', 'u+ctrl']);

    engine.dispose();
  });

  test('scrollKeys: false delivers PageUp to listeners without consuming', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5, scrollKeys: false });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 15; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    const received: string[] = [];
    engine.addInputListener((ev) => {
      if (ev.type === 'key') {
        received.push(ev.key.name);
      }
    });

    io.feed('\x1b[5~');
    await engine.flush();

    expect(engine.getScrollState().offset).toBe(0);
    expect(received).toEqual(['pageup']);

    engine.dispose();
  });

  test('Mouse wheel scrolling, fragmentation, and ignoring horizontal wheel or clicks', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 6, mouse: true });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 20; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    const received: InputEvent[] = [];
    engine.addInputListener((ev) => {
      received.push(ev);
    });

    // Wheel up (btn 64) -> scroll by 3
    io.feed('\x1b[<64;10;5M');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(3);

    // Wheel up fragmented across chunks (\x1b[<64;10; and 5M) -> scroll by 3
    io.feed('\x1b[<64;10;');
    io.feed('5M');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(6);

    // Horizontal wheel (btn 66 = wheelLeft, btn 67 = wheelRight) -> ignored
    io.feed('\x1b[<66;10;5M');
    io.feed('\x1b[<67;10;5M');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(6);

    // Clicks and motion (btn 0 = click, btn 35 = move) -> ignored
    io.feed('\x1b[<0;10;5M\x1b[<35;10;5M');
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(6);

    // No mouse events should ever be forwarded to custom listeners
    expect(received).toEqual([]);

    engine.dispose();
  });

  test('Snap-to-bottom on typing character or pasting while scrolled up', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 6 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    for (let i = 0; i < 20; i++) {
      engine.commit([`line ${i}`]);
    }
    await engine.flush();

    engine.scrollBy(8);
    await engine.flush();
    expect(engine.getScrollState().offset).toBe(8);

    let offsetSeenByListener = -1;
    engine.addInputListener((ev) => {
      if (ev.type === 'key' && ev.input === 'a') {
        offsetSeenByListener = engine.getScrollState().offset;
      }
    });

    // Type 'a'
    io.feed('a');
    await engine.flush();

    // View snapped to bottom BEFORE listener ran
    expect(offsetSeenByListener).toBe(0);
    expect(engine.getScrollState().offset).toBe(0);

    engine.dispose();
  });

  test('Lone ESC timeout resolves to escape event', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    const received: string[] = [];
    engine.addInputListener((ev) => {
      if (ev.type === 'key') {
        received.push(ev.key.name);
      }
    });

    // Send lone ESC
    io.feed('\x1b');
    // Immediate: should not have resolved yet
    expect(received).toEqual([]);

    // Wait for ESC_TIMEOUT_MS (50ms + margin)
    await new Promise((r) => setTimeout(r, 70));
    expect(received).toEqual(['escape']);

    engine.dispose();
  });

  test('Bracketed paste delivered as paste event to listeners and idle timeout', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    const pastes: string[] = [];
    engine.addInputListener((ev) => {
      if (ev.type === 'paste') {
        pastes.push(ev.text);
      }
    });

    // Standard bracketed paste
    io.feed('\x1b[200~Pasted line 1\r\nPasted line 2\x1b[201~');
    expect(pastes).toEqual(['Pasted line 1\nPasted line 2']);

    engine.dispose();
  });

  test('Focus events are swallowed and do not swallow adjacent keystrokes', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    const received: string[] = [];
    engine.addInputListener((ev) => {
      if (ev.type === 'key') {
        received.push(ev.key.name);
      }
    });

    // \x1b[I followed immediately by 'h' 'i'
    io.feed('\x1b[Ihi');
    expect(received).toEqual(['h', 'i']);

    engine.dispose();
  });

  test('Listener ordering newest to oldest and early return', async () => {
    const { engine, io } = makeEngine({ columns: 40, rows: 5 });
    engine.ensureAlternateScreen();
    engine.mount(new LiveComp());

    const order: string[] = [];
    engine.addInputListener(() => {
      order.push('first-registered');
    });

    engine.addInputListener((ev) => {
      order.push('second-registered');
      if (ev.type === 'key' && ev.input === 'q') {
        return true; // Stop propagation
      }
    });

    // Feed 'q'
    io.feed('q');
    expect(order).toEqual(['second-registered']);

    // Feed 'a'
    order.length = 0;
    io.feed('a');
    expect(order).toEqual(['second-registered', 'first-registered']);

    engine.dispose();
  });

  test('Bracketed paste delivers atomic typed paste event without throwing on ev.key', () => {
    const { engine, io } = makeEngine({ columns: 80, rows: 24 });
    engine.ensureAlternateScreen();

    const events: any[] = [];
    engine.addInputListener((ev) => {
      // Must not throw when accessing ev.key
      const k = ev.key;
      expect(k).toBeDefined();
      expect(k.ctrl).toBe(false);
      events.push(ev);
      return false;
    });

    // Feeding typed character
    io.feed('a');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('key');
    expect(events[0].input).toBe('a');

    // Feeding bracketed paste with multiline text
    io.feed('\x1b[200~hello\nworld\x1b[201~');
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('paste');
    expect(events[1].isPaste).toBe(true);
    expect(events[1].key.paste).toBe(true);
    expect(events[1].text).toBe('hello\nworld');
    expect(events[1].input).toBe('hello\nworld');

    engine.dispose();
  });

  test('flushInput flushes unterminated paste and escape sequences deterministically', () => {
    const { engine, io } = makeEngine({ columns: 80, rows: 24 });
    engine.ensureAlternateScreen();

    const events: any[] = [];
    engine.addInputListener((ev) => {
      events.push(ev);
    });

    // Feed lone ESC
    io.feed('\x1b');
    expect(events).toHaveLength(0); // Pending ESC timer
    engine.flushInput();
    expect(events).toHaveLength(1);
    expect(events[0].key.name).toBe('escape');

    // Feed unterminated paste
    io.feed('\x1b[200~buffered text');
    engine.flushInput();
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('paste');
    expect(events[1].text).toBe('buffered text');

    engine.dispose();
  });
});
