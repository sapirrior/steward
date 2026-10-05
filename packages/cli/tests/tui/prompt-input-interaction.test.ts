import { describe, expect, it } from 'bun:test';
import PromptInput from '../../src/interface/components/PromptInput.js';
import { makeEngine } from '../helpers/app.js';

describe('PromptInput Interaction & Typing', () => {
  it('accepts keystrokes and updates state value and cursor', () => {
    let submitted = '';
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      onSubmit: (text) => {
        submitted = text;
      },
    });

    engine.mount(prompt);

    // Type 'hello'
    for (const char of 'hello') {
      io.feed(char);
    }

    expect(prompt.state.value).toBe('hello');
    expect(prompt.state.cursorPos).toBe(5);

    // Press Enter
    io.feed('\r');
    expect(submitted).toBe('hello');
    expect(prompt.state.value).toBe('');
    expect(prompt.state.cursorPos).toBe(0);

    engine.dispose();
  });

  it('supports backspace, cursor movement, and history', () => {
    let submitted = '';
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      initialHistory: ['previous command'],
      onSubmit: (text) => {
        submitted = text;
      },
    });

    engine.mount(prompt);

    // Type 'abc'
    io.feed('a');
    io.feed('b');
    io.feed('c');
    expect(prompt.state.value).toBe('abc');

    // Backspace
    io.feed('\x7f');
    expect(prompt.state.value).toBe('ab');

    // Navigate history up
    prompt.setState({ value: '', cursorPos: 0 });
    io.feed('\x1b[A'); // Arrow Up
    expect(prompt.state.value).toBe('previous command');

    engine.dispose();
  });

  it('cycles command palette suggestions with Arrow Up / Down without jumping to history', () => {
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      initialHistory: ['git status'],
      onSubmit: () => {},
    });

    engine.mount(prompt);

    // Type '/'
    io.feed('/');
    expect(prompt.state.value).toBe('/');

    // Arrow Down multiple times (should wrap around and not jump to history)
    for (let i = 0; i < 15; i++) {
      io.feed('\x1b[B'); // Arrow Down
    }
    expect(prompt.state.value).toBe('/');

    // Arrow Up (should navigate suggestions upward and not replace with 'git status')
    io.feed('\x1b[A'); // Arrow Up
    expect(prompt.state.value).toBe('/');

    engine.dispose();
  });

  it('allows drafting text during disabled/busy state and blocks Enter submission', () => {
    let submitted = '';
    let aborted = false;
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      onSubmit: (text) => {
        submitted = text;
      },
      onAbort: () => {
        aborted = true;
      },
    });

    engine.mount(prompt);
    prompt.setDisabled(true);

    // Typing while disabled should update the prompt input state
    for (const char of 'drafting my next question') {
      io.feed(char);
    }
    expect(prompt.state.value).toBe('drafting my next question');
    expect(prompt.state.cursorPos).toBe('drafting my next question'.length);

    // Pressing Enter while disabled should NOT submit
    io.feed('\r');
    expect(submitted).toBe('');
    expect(prompt.state.value).toBe('drafting my next question');

    // Pressing Escape should trigger onAbort
    io.feed('\x1b');
    engine.flushInput();
    expect(aborted).toBe(true);

    // Once re-enabled, pressing Enter submits the drafted prompt
    prompt.setDisabled(false);
    io.feed('\r');
    expect(submitted).toBe('drafting my next question');
    expect(prompt.state.value).toBe('');

    engine.dispose();
  });

  it('supports bracketed paste with multiline text and does not submit', () => {
    let submitted = '';
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      onSubmit: (text) => {
        submitted = text;
      },
    });

    engine.mount(prompt);

    // Feed multiline paste
    io.feed('\x1b[200~function test() {\n  return 42;\n}\x1b[201~');

    expect(submitted).toBe('');
    expect(prompt.state.value).toBe('function test() {\n  return 42;\n}');
    expect(prompt.state.cursorPos).toBe('function test() {\n  return 42;\n}'.length);

    engine.dispose();
  });

  it('pasted lone question mark ? does not trigger help modal', () => {
    let helpToggled = false;
    const { engine, io } = makeEngine();
    engine.ensureAlternateScreen();

    const prompt = new PromptInput({
      onSubmit: () => {},
      onToggleHelp: () => {
        helpToggled = true;
      },
    });

    engine.mount(prompt);

    // Pasting ?
    io.feed('\x1b[200~?\x1b[201~');
    expect(helpToggled).toBe(false);
    expect(prompt.state.value).toBe('?');

    // Clear prompt and type ? manually
    prompt.setState({ value: '', cursorPos: 0 });
    io.feed('?');
    expect(helpToggled).toBe(true);

    engine.dispose();
  });
});
