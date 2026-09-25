import { describe, expect, it } from 'bun:test';
import { TerminalEngine } from '../../src/packages/tui/src/engine/TerminalEngine.js';
import PromptInput from '../../src/app/ui/components/PromptInput.js';

describe('PromptInput Interaction & Typing', () => {
  it('accepts keystrokes and updates state value and cursor', () => {
    let submitted = '';
    const engine = new TerminalEngine();
    const prompt = new PromptInput({
      onSubmit: (text) => {
        submitted = text;
      },
    });

    engine.mount(prompt, { kind: 'input' });

    // Type 'hello'
    for (const char of 'hello') {
      process.stdin.emit('data', Buffer.from(char));
    }

    expect(prompt.state.value).toBe('hello');
    expect(prompt.state.cursorPos).toBe(5);

    // Press Enter
    process.stdin.emit('data', Buffer.from('\r'));
    expect(submitted).toBe('hello');
    expect(prompt.state.value).toBe('');
    expect(prompt.state.cursorPos).toBe(0);

    engine.cleanupSync();
  });

  it('supports backspace, cursor movement, and history', () => {
    let submitted = '';
    const engine = new TerminalEngine();
    const prompt = new PromptInput({
      initialHistory: ['previous command'],
      onSubmit: (text) => {
        submitted = text;
      },
    });

    engine.mount(prompt, { kind: 'input' });

    // Type 'abc'
    process.stdin.emit('data', Buffer.from('a'));
    process.stdin.emit('data', Buffer.from('b'));
    process.stdin.emit('data', Buffer.from('c'));
    expect(prompt.state.value).toBe('abc');

    // Backspace
    process.stdin.emit('data', Buffer.from('\x7f')); // backspace
    expect(prompt.state.value).toBe('ab');

    // Navigate history up
    prompt.setState({ value: '', cursorPos: 0 });
    process.stdin.emit('data', Buffer.from('\x1b[A')); // Arrow Up
    expect(prompt.state.value).toBe('previous command');

    engine.cleanupSync();
  });

  it('cycles command palette suggestions with Arrow Up / Down without jumping to history', () => {
    const engine = new TerminalEngine();
    const prompt = new PromptInput({
      initialHistory: ['git status'],
      onSubmit: () => {},
    });

    engine.mount(prompt, { kind: 'input' });

    // Type '/'
    process.stdin.emit('data', Buffer.from('/'));
    expect(prompt.state.value).toBe('/');

    // Arrow Down multiple times (should wrap around and not jump to history)
    for (let i = 0; i < 15; i++) {
      process.stdin.emit('data', Buffer.from('\x1b[B')); // Arrow Down
    }
    expect(prompt.state.value).toBe('/');

    // Arrow Up (should navigate suggestions upward and not replace with 'git status')
    process.stdin.emit('data', Buffer.from('\x1b[A')); // Arrow Up
    expect(prompt.state.value).toBe('/');

    engine.cleanupSync();
  });
});
