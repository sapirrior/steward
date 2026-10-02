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
}

export interface InputEvent {
  input: string;
  key: Key;
  isPaste?: boolean;
}

function emptyKey(): Key {
  return {
    name: '',
    ctrl: false,
    meta: false,
    shift: false,
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    tab: false,
    backspace: false,
    delete: false,
  };
}

/**
 * Parses raw terminal input chunk into an array of InputEvents.
 * Handles multiple keys per chunk, bracketed paste, escape sequences, and Ctrl/Alt modifiers.
 */
export function parseInputChunk(chunk: string): InputEvent[] {
  const events: InputEvent[] = [];
  let i = 0;

  while (i < chunk.length) {
    // 1. Bracketed paste: \x1b[200~ ... \x1b[201~
    if (chunk.startsWith('\x1b[200~', i)) {
      const start = i + 6;
      const endIdx = chunk.indexOf('\x1b[201~', start);
      if (endIdx !== -1) {
        const pasteContent = chunk.slice(start, endIdx);
        events.push({
          input: pasteContent,
          key: emptyKey(),
          isPaste: true,
        });
        i = endIdx + 6;
        continue;
      } else {
        // Unterminated paste: treat remaining as pasted text
        const pasteContent = chunk.slice(start);
        events.push({
          input: pasteContent,
          key: emptyKey(),
          isPaste: true,
        });
        break;
      }
    }

    // 2. Escape sequences
    if (chunk[i] === '\x1b') {
      const rest = chunk.slice(i);

      // Arrow keys with CSI: \x1b[A, \x1b[B, \x1b[C, \x1b[D
      if (rest.startsWith('\x1b[A')) {
        const key = emptyKey();
        key.upArrow = true;
        key.name = 'up';
        events.push({ input: '', key });
        i += 3;
        continue;
      }
      if (rest.startsWith('\x1b[B')) {
        const key = emptyKey();
        key.downArrow = true;
        key.name = 'down';
        events.push({ input: '', key });
        i += 3;
        continue;
      }
      if (rest.startsWith('\x1b[C')) {
        const key = emptyKey();
        key.rightArrow = true;
        key.name = 'right';
        events.push({ input: '', key });
        i += 3;
        continue;
      }
      if (rest.startsWith('\x1b[D')) {
        const key = emptyKey();
        key.leftArrow = true;
        key.name = 'left';
        events.push({ input: '', key });
        i += 3;
        continue;
      }

      // Modified Arrows: \x1b[1;5A (Ctrl+Up), \x1b[1;2A (Shift+Up), etc.
      const modArrowMatch = /^\x1b\[1;(\d+)([A-D])/.exec(rest);
      if (modArrowMatch) {
        const mod = parseInt(modArrowMatch[1]!, 10);
        const code = modArrowMatch[2]!;
        const key = emptyKey();
        if (mod === 2) key.shift = true;
        if (mod === 3) key.meta = true;
        if (mod === 5) key.ctrl = true;
        if (mod === 6) {
          key.ctrl = true;
          key.shift = true;
        }

        if (code === 'A') {
          key.upArrow = true;
          key.name = 'up';
        }
        if (code === 'B') {
          key.downArrow = true;
          key.name = 'down';
        }
        if (code === 'C') {
          key.rightArrow = true;
          key.name = 'right';
        }
        if (code === 'D') {
          key.leftArrow = true;
          key.name = 'left';
        }

        events.push({ input: '', key });
        i += modArrowMatch[0].length;
        continue;
      }

      // PageUp / PageDown: \x1b[5~, \x1b[6~
      if (rest.startsWith('\x1b[5~')) {
        const key = emptyKey();
        key.pageUp = true;
        key.name = 'pageup';
        events.push({ input: '', key });
        i += 4;
        continue;
      }
      if (rest.startsWith('\x1b[6~')) {
        const key = emptyKey();
        key.pageDown = true;
        key.name = 'pagedown';
        events.push({ input: '', key });
        i += 4;
        continue;
      }

      // Home / End: \x1b[H, \x1b[F, \x1b[1~, \x1b[4~
      if (rest.startsWith('\x1b[H') || rest.startsWith('\x1b[1~')) {
        const key = emptyKey();
        key.home = true;
        key.name = 'home';
        events.push({ input: '', key });
        i += rest.startsWith('\x1b[1~') ? 4 : 3;
        continue;
      }
      if (rest.startsWith('\x1b[F') || rest.startsWith('\x1b[4~')) {
        const key = emptyKey();
        key.end = true;
        key.name = 'end';
        events.push({ input: '', key });
        i += rest.startsWith('\x1b[4~') ? 4 : 3;
        continue;
      }

      // Delete: \x1b[3~
      if (rest.startsWith('\x1b[3~')) {
        const key = emptyKey();
        key.delete = true;
        key.name = 'delete';
        events.push({ input: '', key });
        i += 4;
        continue;
      }

      // Shift+Tab: \x1b[Z
      if (rest.startsWith('\x1b[Z')) {
        const key = emptyKey();
        key.tab = true;
        key.shift = true;
        key.name = 'tab';
        events.push({ input: '\t', key });
        i += 3;
        continue;
      }

      // Alt+<char>: \x1b<char>
      if (rest.length >= 2 && rest[1] !== '[') {
        const char = rest[1]!;
        const key = emptyKey();
        key.meta = true;
        key.name = char;
        events.push({ input: char, key });
        i += 2;
        continue;
      }

      // Lone escape
      if (rest === '\x1b') {
        const key = emptyKey();
        key.escape = true;
        key.name = 'escape';
        events.push({ input: '\x1b', key });
        i += 1;
        continue;
      }

      // Generic unhandled CSI escape: skip until final byte (0x40-0x7e)
      const csiMatch = /^\x1b\[[0-9;?]*[@-~]/.exec(rest);
      if (csiMatch) {
        i += csiMatch[0].length;
        continue;
      }

      i += 1;
      continue;
    }

    // 3. Control characters
    const char = chunk[i]!;
    const code = char.charCodeAt(0);

    // Enter / Return: \r, \n
    if (char === '\r' || char === '\n') {
      const key = emptyKey();
      key.return = true;
      key.name = 'return';
      events.push({ input: '\n', key });
      i += 1;
      continue;
    }

    // Tab: \t
    if (char === '\t') {
      const key = emptyKey();
      key.tab = true;
      key.name = 'tab';
      events.push({ input: '\t', key });
      i += 1;
      continue;
    }

    // Backspace: \x08 or \x7f
    if (code === 8 || code === 127) {
      const key = emptyKey();
      key.backspace = true;
      key.name = 'backspace';
      events.push({ input: '', key });
      i += 1;
      continue;
    }

    // Ctrl+<letter>: code 1 to 26 (except 9=tab, 10=lf, 13=cr)
    if (code >= 1 && code <= 26) {
      const letter = String.fromCharCode(96 + code); // 1 -> 'a'
      const key = emptyKey();
      key.ctrl = true;
      key.name = letter;
      events.push({ input: letter, key });
      i += 1;
      continue;
    }

    // 4. Regular characters (single or multi-byte grapheme)
    const key = emptyKey();
    key.name = char;
    if (char >= 'A' && char <= 'Z') {
      key.shift = true;
    }
    events.push({ input: char, key });
    i += 1;
  }

  return events;
}
