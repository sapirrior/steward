import { describe, it, expect } from 'bun:test';
import { handleChoiceKey, renderChoiceOption } from '../src/interface/utils/choice.js';
import type { InputEvent } from 'stitchable';

function makeKey(name: string, modifiers: Partial<InputEvent['key']> = {}): InputEvent['key'] {
  return {
    name,
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    paste: false,
    ...modifiers,
  };
}

describe('Choice Helper (S8)', () => {
  it('ignores bracketed paste events', () => {
    const pasteEv: InputEvent = {
      type: 'paste',
      input: '1\n2\n',
      key: makeKey('paste', { paste: true }),
      isPaste: true,
    };
    expect(handleChoiceKey(pasteEv, 0, 2)).toBeNull();
  });

  it('cycles through choices with arrow keys and wrap around', () => {
    const downEv: InputEvent = {
      type: 'key',
      input: '',
      key: makeKey('down', { downArrow: true }),
      isPaste: false,
    };
    expect(handleChoiceKey(downEv, 0, 2)).toEqual({ type: 'move', index: 1 });
    expect(handleChoiceKey(downEv, 1, 2)).toEqual({ type: 'move', index: 0 });

    const upEv: InputEvent = {
      type: 'key',
      input: '',
      key: makeKey('up', { upArrow: true }),
      isPaste: false,
    };
    expect(handleChoiceKey(upEv, 0, 2)).toEqual({ type: 'move', index: 1 });
    expect(handleChoiceKey(upEv, 1, 2)).toEqual({ type: 'move', index: 0 });
  });

  it('handles direct number keys 1 and 2', () => {
    const key1: InputEvent = {
      type: 'key',
      input: '1',
      key: makeKey('1'),
      isPaste: false,
    };
    expect(handleChoiceKey(key1, 1, 2)).toEqual({ type: 'move', index: 0 });

    const key2: InputEvent = {
      type: 'key',
      input: '2',
      key: makeKey('2'),
      isPaste: false,
    };
    expect(handleChoiceKey(key2, 0, 2)).toEqual({ type: 'move', index: 1 });
  });

  it('handles return to confirm and escape to cancel', () => {
    const returnEv: InputEvent = {
      type: 'key',
      input: '\r',
      key: makeKey('return', { return: true }),
      isPaste: false,
    };
    expect(handleChoiceKey(returnEv, 1, 2)).toEqual({ type: 'confirm', index: 1 });

    const escEv: InputEvent = {
      type: 'key',
      input: '\x1b',
      key: makeKey('escape', { escape: true }),
      isPaste: false,
    };
    expect(handleChoiceKey(escEv, 0, 2)).toEqual({ type: 'cancel' });
  });

  it('renderChoiceOption formats selected and unselected lines', () => {
    const selected = renderChoiceOption('Option 1', true);
    expect(selected).toContain('Option 1');

    const unselected = renderChoiceOption('Option 2', false);
    expect(unselected).toContain('Option 2');
  });
});
