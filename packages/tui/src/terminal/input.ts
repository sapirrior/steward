export interface Key {
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  upArrow: boolean;
  downArrow: boolean;
  leftArrow: boolean;
  rightArrow: boolean;
  pageDown: boolean;
  pageUp: boolean;
  home: boolean;
  end: boolean;
  return: boolean;
  escape: boolean;
  tab: boolean;
  backspace: boolean;
  delete: boolean;
  paste: boolean;
}

export type TerminalEvent =
  | { type: 'key'; input: string; key: Key }
  | { type: 'paste'; text: string }
  | {
      type: 'mouse';
      action: 'press' | 'release' | 'move' | 'wheel';
      button:
        'left' | 'middle' | 'right' | 'none' | 'wheelUp' | 'wheelDown' | 'wheelLeft' | 'wheelRight';
      col: number;
      row: number;
      shift: boolean;
      meta: boolean;
      ctrl: boolean;
    }
  | { type: 'focus'; focused: boolean };

export type InputEvent =
  | { type: 'key'; input: string; key: Key; isPaste?: false; text?: undefined }
  | { type: 'paste'; input: string; text: string; key: Key; isPaste: true };

/**
 * Converts a raw TerminalEvent into a safe, typed InputEvent.
 * Returns null for mouse and focus events which do not reach custom input listeners.
 */
export function toInputEvent(ev: TerminalEvent): InputEvent | null {
  if (ev.type === 'key') {
    return {
      type: 'key',
      input: ev.input,
      key: ev.key,
      isPaste: false,
    };
  }
  if (ev.type === 'paste') {
    return {
      type: 'paste',
      input: ev.text,
      text: ev.text,
      key: makeKey('paste', { paste: true }),
      isPaste: true,
    };
  }
  return null;
}

export const MAX_SEQUENCE_BYTES = 256;
export const MAX_PASTE_CHARS = 1_048_576;
export const ESC_TIMEOUT_MS = 50;
export const PASTE_IDLE_MS = 500;

export function makeKey(
  name: string,
  mods?: { ctrl?: boolean; meta?: boolean; shift?: boolean; paste?: boolean },
): Key {
  const ctrl = mods?.ctrl ?? false;
  const meta = mods?.meta ?? false;
  const shift = mods?.shift ?? false;
  const paste = mods?.paste ?? false;

  return {
    name,
    ctrl,
    meta,
    shift,
    upArrow: name === 'up',
    downArrow: name === 'down',
    leftArrow: name === 'left',
    rightArrow: name === 'right',
    pageDown: name === 'pagedown',
    pageUp: name === 'pageup',
    home: name === 'home',
    end: name === 'end',
    return: name === 'return',
    escape: name === 'escape',
    tab: name === 'tab',
    backspace: name === 'backspace',
    delete: name === 'delete',
    paste,
  };
}

function decodeModifiers(modNum: number): { ctrl: boolean; meta: boolean; shift: boolean } {
  const bits = Math.max(0, modNum - 1);
  return {
    shift: (bits & 1) !== 0,
    meta: (bits & 2) !== 0 || (bits & 32) !== 0,
    ctrl: (bits & 4) !== 0,
  };
}

function sanitizePaste(text: string): string {
  // Normalize newlines to \n
  let out = text.replace(/\r\n|\r/g, '\n');
  // Strip ESC (0x1b) and C0 controls except \t (0x09) and \n (0x0A)
  // eslint-disable-next-line no-control-regex
  out = out.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  return out;
}

export class InputParser {
  private buf = '';
  private pasteBuf = '';
  private inPasteMode = false;

  get pending(): boolean {
    return this.buf.length > 0;
  }

  get inPaste(): boolean {
    return this.inPasteMode;
  }

  reset(): void {
    this.buf = '';
    this.pasteBuf = '';
    this.inPasteMode = false;
  }

  flushPaste(): TerminalEvent[] {
    if (this.inPasteMode && this.pasteBuf.length > 0) {
      const text = sanitizePaste(this.pasteBuf);
      this.pasteBuf = '';
      this.inPasteMode = false;
      return [{ type: 'paste', text }];
    }
    this.inPasteMode = false;
    this.pasteBuf = '';
    return [];
  }

  flush(): TerminalEvent[] {
    const events: TerminalEvent[] = [];
    if (this.buf.length > 0) {
      if (this.buf === '\x1b') {
        events.push({ type: 'key', input: '', key: makeKey('escape') });
      } else if (this.buf === '\x1b[') {
        events.push({ type: 'key', input: '', key: makeKey('[', { meta: true }) });
      } else if (this.buf === '\x1bO') {
        events.push({ type: 'key', input: '', key: makeKey('O', { meta: true }) });
      }
      this.buf = '';
    }
    return events;
  }

  feed(chunk: string): TerminalEvent[] {
    const events: TerminalEvent[] = [];
    this.buf += chunk;

    while (this.buf.length > 0) {
      // 1. Bracketed paste mode active
      if (this.inPasteMode) {
        const termIdx = this.buf.indexOf('\x1b[201~');
        if (termIdx !== -1) {
          this.pasteBuf += this.buf.slice(0, termIdx);
          this.buf = this.buf.slice(termIdx + 6);
          this.inPasteMode = false;
          events.push({ type: 'paste', text: sanitizePaste(this.pasteBuf) });
          this.pasteBuf = '';
          continue;
        }

        // Check if buffer ends with a partial prefix of '\x1b[201~'
        const termPrefixes = ['\x1b[201~', '\x1b[201', '\x1b[20', '\x1b[2', '\x1b[', '\x1b'];
        let holdback = 0;
        for (const prefix of termPrefixes) {
          if (this.buf.endsWith(prefix)) {
            holdback = prefix.length;
            break;
          }
        }

        const toAppend = this.buf.slice(0, this.buf.length - holdback);
        this.pasteBuf += toAppend;
        this.buf = this.buf.slice(this.buf.length - holdback);

        if (this.pasteBuf.length >= MAX_PASTE_CHARS) {
          events.push({ type: 'paste', text: sanitizePaste(this.pasteBuf) });
          this.pasteBuf = '';
        }
        break;
      }

      // 2. Escape sequence parsing
      if (this.buf.charCodeAt(0) === 0x1b) {
        if (this.buf.length === 1) {
          // Lone ESC in buffer, wait for more chunks or flush()
          break;
        }

        const second = this.buf[1]!;

        // 2A. CSI Sequence (\x1b[...)
        if (second === '[') {
          // Check for bracketed paste start '\x1b[200~'
          if (this.buf.startsWith('\x1b[200~')) {
            this.buf = this.buf.slice(6);
            this.inPasteMode = true;
            this.pasteBuf = '';
            continue;
          }

          // Scan for final byte (0x40 - 0x7E)
          let finalIdx = -1;
          for (let i = 2; i < this.buf.length; i++) {
            const code = this.buf.charCodeAt(i);
            if (code >= 0x40 && code <= 0x7e) {
              finalIdx = i;
              break;
            }
          }

          if (finalIdx === -1) {
            if (this.buf.length >= MAX_SEQUENCE_BYTES) {
              // Overflow safety: discard un-terminated sequence
              this.buf = '';
            }
            break; // Incomplete CSI, wait for more data
          }

          const finalChar = this.buf[finalIdx]!;
          const body = this.buf.slice(2, finalIdx);
          this.buf = this.buf.slice(finalIdx + 1);

          // SGR Mouse: \x1b[<b;x;yM or \x1b[<b;x;ym
          if (body.startsWith('<') && (finalChar === 'M' || finalChar === 'm')) {
            const parts = body.slice(1).split(';');
            if (parts.length >= 3) {
              const b = parseInt(parts[0]!, 10) || 0;
              const col = parseInt(parts[1]!, 10) || 1;
              const row = parseInt(parts[2]!, 10) || 1;

              const shift = (b & 4) !== 0;
              const meta = (b & 8) !== 0;
              const ctrl = (b & 16) !== 0;
              const isMotion = (b & 32) !== 0;
              const isWheel = (b & 64) !== 0;

              let action: 'press' | 'release' | 'move' | 'wheel';
              let button:
                | 'left'
                | 'middle'
                | 'right'
                | 'none'
                | 'wheelUp'
                | 'wheelDown'
                | 'wheelLeft'
                | 'wheelRight';

              if (isWheel) {
                action = 'wheel';
                const wheelCode = b & 3;
                if (wheelCode === 0) button = 'wheelUp';
                else if (wheelCode === 1) button = 'wheelDown';
                else if (wheelCode === 2) button = 'wheelLeft';
                else button = 'wheelRight';
              } else if (isMotion) {
                action = 'move';
                button = 'none';
              } else if (finalChar === 'm') {
                action = 'release';
                const btnCode = b & 3;
                button =
                  btnCode === 0
                    ? 'left'
                    : btnCode === 1
                      ? 'middle'
                      : btnCode === 2
                        ? 'right'
                        : 'none';
              } else {
                action = 'press';
                const btnCode = b & 3;
                button =
                  btnCode === 0
                    ? 'left'
                    : btnCode === 1
                      ? 'middle'
                      : btnCode === 2
                        ? 'right'
                        : 'none';
              }

              events.push({
                type: 'mouse',
                action,
                button,
                col,
                row,
                shift,
                meta,
                ctrl,
              });
            }
            continue;
          }

          // Legacy X10 Mouse: \x1b[M followed by 3 bytes
          if (body === '' && finalChar === 'M') {
            if (this.buf.length < 3) {
              // Put back the \x1b[M and wait for payload bytes
              this.buf = '\x1b[M' + this.buf;
              break;
            }
            // Consume 3 bytes and discard
            this.buf = this.buf.slice(3);
            continue;
          }

          // Focus In / Out: \x1b[I / \x1b[O
          if (body === '' && finalChar === 'I') {
            events.push({ type: 'focus', focused: true });
            continue;
          }
          if (body === '' && finalChar === 'O') {
            events.push({ type: 'focus', focused: false });
            continue;
          }

          // CSI-u: \x1b[<codepoint>[;<mod>]u
          if (finalChar === 'u') {
            const parts = body.split(';');
            const codepoint = parseInt(parts[0]!, 10);
            if (!isNaN(codepoint)) {
              const mod = parts.length > 1 ? parseInt(parts[1]!, 10) : 1;
              const mods = decodeModifiers(mod);
              const char = String.fromCodePoint(codepoint);
              const isPlainChar = !mods.ctrl && !mods.meta;
              events.push({
                type: 'key',
                input: isPlainChar ? char : '',
                key: makeKey(char, mods),
              });
            }
            continue;
          }

          // Arrows & Standard Keys: A (Up), B (Down), C (Right), D (Left), H (Home), F (End)
          if (['A', 'B', 'C', 'D', 'H', 'F'].includes(finalChar)) {
            let mods = { ctrl: false, meta: false, shift: false };
            if (body.includes(';')) {
              const parts = body.split(';');
              const modNum = parseInt(parts[1]!, 10);
              if (!isNaN(modNum)) {
                mods = decodeModifiers(modNum);
              }
            }
            let name = 'up';
            if (finalChar === 'B') name = 'down';
            else if (finalChar === 'C') name = 'right';
            else if (finalChar === 'D') name = 'left';
            else if (finalChar === 'H') name = 'home';
            else if (finalChar === 'F') name = 'end';

            events.push({
              type: 'key',
              input: '',
              key: makeKey(name, mods),
            });
            continue;
          }

          // Tilde ~ keys: PageUp, PageDown, Delete, Insert, Home, End, F-keys
          if (finalChar === '~') {
            const parts = body.split(';');
            const code = parseInt(parts[0]!, 10);
            const mod = parts.length > 1 ? parseInt(parts[1]!, 10) : 1;
            const mods = decodeModifiers(mod);

            let name = '';
            if (code === 1 || code === 7) name = 'home';
            else if (code === 2) name = 'insert';
            else if (code === 3) name = 'delete';
            else if (code === 4 || code === 8) name = 'end';
            else if (code === 5) name = 'pageup';
            else if (code === 6) name = 'pagedown';
            else if (code >= 11 && code <= 15) name = `f${code - 10}`;
            else if (code >= 17 && code <= 21) name = `f${code - 11}`;
            else if (code === 23) name = 'f11';
            else if (code === 24) name = 'f12';

            if (name) {
              events.push({
                type: 'key',
                input: '',
                key: makeKey(name, mods),
              });
            }
            continue;
          }

          // Shift+Tab: \x1b[Z
          if (finalChar === 'Z') {
            events.push({
              type: 'key',
              input: '',
              key: makeKey('tab', { shift: true }),
            });
            continue;
          }

          // Any other well-formed CSI is consumed with no event
          continue;
        }

        // 2B. SS3 Sequences (\x1bO...)
        if (second === 'O') {
          if (this.buf.length < 3) {
            break; // Pending SS3
          }
          const finalChar = this.buf[2]!;
          this.buf = this.buf.slice(3);

          let name = '';
          if (finalChar === 'A') name = 'up';
          else if (finalChar === 'B') name = 'down';
          else if (finalChar === 'C') name = 'right';
          else if (finalChar === 'D') name = 'left';
          else if (finalChar === 'H') name = 'home';
          else if (finalChar === 'F') name = 'end';
          else if (finalChar === 'P') name = 'f1';
          else if (finalChar === 'Q') name = 'f2';
          else if (finalChar === 'R') name = 'f3';
          else if (finalChar === 'S') name = 'f4';

          if (name) {
            events.push({
              type: 'key',
              input: '',
              key: makeKey(name),
            });
          }
          continue;
        }

        // 2C. String sequences: OSC (]), DCS (P), APC (_), PM (^), SOS (X)
        if ([']', 'P', '_', '^', 'X'].includes(second)) {
          // Look for BEL (\x07) or ST (\x1b\\)
          const belIdx = this.buf.indexOf('\x07');
          const stIdx = this.buf.indexOf('\x1b\\');
          let termIdx = -1;
          let termLen = 1;

          if (belIdx !== -1 && (stIdx === -1 || belIdx < stIdx)) {
            termIdx = belIdx;
            termLen = 1;
          } else if (stIdx !== -1) {
            termIdx = stIdx;
            termLen = 2;
          }

          if (termIdx !== -1) {
            this.buf = this.buf.slice(termIdx + termLen);
            continue;
          }

          if (this.buf.length >= MAX_SEQUENCE_BYTES) {
            this.buf = '';
          }
          break; // Pending string sequence
        }

        // 2D. Alt+Escape: \x1b\x1b
        if (second === '\x1b') {
          this.buf = this.buf.slice(2);
          events.push({
            type: 'key',
            input: '',
            key: makeKey('escape', { meta: true }),
          });
          continue;
        }

        // 2E. Alt + Key / Alt + Control character: \x1b<char>
        this.buf = this.buf.slice(2);
        if (second === '\r' || second === '\n') {
          events.push({ type: 'key', input: '', key: makeKey('return', { meta: true }) });
        } else if (second === '\t') {
          events.push({ type: 'key', input: '', key: makeKey('tab', { meta: true }) });
        } else if (second === '\x08' || second === '\x7f') {
          events.push({ type: 'key', input: '', key: makeKey('backspace', { meta: true }) });
        } else {
          events.push({
            type: 'key',
            input: '',
            key: makeKey(second, { meta: true }),
          });
        }
        continue;
      }

      // 3. Control characters (C0)
      const code = this.buf.charCodeAt(0);

      // Return / Enter: \r (0x0D), \n (0x0A)
      if (code === 0x0d || code === 0x0a) {
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey('return'),
        });
        continue;
      }

      // Tab: \t (0x09)
      if (code === 0x09) {
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey('tab'),
        });
        continue;
      }

      // Backspace: \x08 or \x7f
      if (code === 0x08 || code === 0x7f) {
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey('backspace'),
        });
        continue;
      }

      // Ctrl+Space / NUL: 0x00
      if (code === 0x00) {
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey('space', { ctrl: true }),
        });
        continue;
      }

      // Ctrl+A through Ctrl+Z: 0x01 - 0x1A
      if (code >= 0x01 && code <= 0x1a) {
        const letter = String.fromCharCode(96 + code); // 1 -> 'a'
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey(letter, { ctrl: true }),
        });
        continue;
      }

      // Ctrl+\, Ctrl+], Ctrl+^, Ctrl+_: 0x1C - 0x1F
      if (code >= 0x1c && code <= 0x1f) {
        const charMap: Record<number, string> = {
          0x1c: '\\',
          0x1d: ']',
          0x1e: '^',
          0x1f: '_',
        };
        const letter = charMap[code]!;
        this.buf = this.buf.slice(1);
        events.push({
          type: 'key',
          input: '',
          key: makeKey(letter, { ctrl: true }),
        });
        continue;
      }

      // 4. Plain printable Unicode text (iterated by code point to avoid surrogate splitting)
      if (code >= 0xd800 && code <= 0xdbff && this.buf.length === 1) {
        break; // Wait for low surrogate
      }

      const point = this.buf.codePointAt(0)!;
      const char = String.fromCodePoint(point);
      this.buf = this.buf.slice(char.length);

      const shift = char >= 'A' && char <= 'Z';
      events.push({
        type: 'key',
        input: char,
        key: makeKey(char, { shift }),
      });
    }

    return events;
  }
}
