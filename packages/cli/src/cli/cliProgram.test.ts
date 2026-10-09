import { describe, it, expect, mock } from 'bun:test';
import { createCliProgram } from './cliProgram.js';

describe('cliProgram Commander routing', () => {
  it('should trigger interactive mode when no prompt or arguments are provided', async () => {
    const onInteractive = mock(() => {});
    const onHeadlessPrompt = mock((_prompt: string) => {});

    const program = createCliProgram({
      onInteractive,
      onHeadlessPrompt,
    });
    program.exitOverride();

    await program.parseAsync([], { from: 'user' });

    expect(onInteractive).toHaveBeenCalledTimes(1);
    expect(onHeadlessPrompt).toHaveBeenCalledTimes(0);
  });

  it('should trigger headless prompt mode and NEVER open interactive when prompt argument is provided', async () => {
    const onInteractive = mock(() => {});
    const onHeadlessPrompt = mock((_prompt: string) => {});

    const program = createCliProgram({
      onInteractive,
      onHeadlessPrompt,
    });
    program.exitOverride();

    await program.parseAsync(['Explain quantum computing'], { from: 'user' });

    expect(onInteractive).toHaveBeenCalledTimes(0);
    expect(onHeadlessPrompt).toHaveBeenCalledTimes(1);
    expect(onHeadlessPrompt).toHaveBeenCalledWith('Explain quantum computing');
  });

  it('should route to config subcommand without triggering interactive or prompt handlers', async () => {
    const onInteractive = mock(() => {});
    const onHeadlessPrompt = mock((_prompt: string) => {});

    const program = createCliProgram({
      onInteractive,
      onHeadlessPrompt,
    });
    program.exitOverride();

    await program.parseAsync(['config', 'list'], { from: 'user' });

    expect(onInteractive).toHaveBeenCalledTimes(0);
    expect(onHeadlessPrompt).toHaveBeenCalledTimes(0);
  });

  it('should support settings alias for config command', async () => {
    const onInteractive = mock(() => {});
    const onHeadlessPrompt = mock((_prompt: string) => {});

    const program = createCliProgram({
      onInteractive,
      onHeadlessPrompt,
    });
    program.exitOverride();

    await program.parseAsync(['settings', 'list'], { from: 'user' });

    expect(onInteractive).toHaveBeenCalledTimes(0);
    expect(onHeadlessPrompt).toHaveBeenCalledTimes(0);
  });
});
