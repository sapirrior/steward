import { describe, it, expect } from 'bun:test';
import { run } from '../../src/cli/run.js';
import { DefaultCliCommandRegistry } from '../../src/cli/registry.js';
import type { CliCommand, CliIO } from '../../src/cli/types.js';

describe('CLI Registry & Runner Unit Tests', () => {
  it('registers commands and resolves by exact name', () => {
    const registry = new DefaultCliCommandRegistry();
    const cmd: CliCommand = {
      name: 'test',
      summary: 'test command',
      usage: 'steward test',
      run: () => 0,
    };
    registry.register(cmd);
    expect(registry.resolve('test')).toBe(cmd);
    expect(registry.resolve('TEST')).toBeUndefined();
    expect(registry.getAll()).toEqual([cmd]);
  });

  it('throws on duplicate command registration', () => {
    const registry = new DefaultCliCommandRegistry();
    const cmd: CliCommand = {
      name: 'test',
      summary: 'test command',
      usage: 'steward test',
      run: () => 0,
    };
    registry.register(cmd);
    expect(() => registry.register(cmd)).toThrow('Duplicate CLI command name');
  });

  it('runs command with injected IO and avoids launch on command execution', async () => {
    const logs: string[] = [];
    const errors: string[] = [];
    const exits: number[] = [];
    let launched = false;

    const io: CliIO = {
      log: (msg) => logs.push(msg),
      error: (msg) => errors.push(msg),
    };

    const registry = new DefaultCliCommandRegistry();
    registry.register({
      name: 'ping',
      summary: 'pings',
      usage: 'steward ping',
      run: (_args, ctx) => {
        ctx.io.log('pong');
        return 0;
      },
    });

    await run(['ping'], {
      registry,
      io,
      exit: (code) => exits.push(code),
      launch: async () => {
        launched = true;
      },
    });

    expect(logs).toEqual(['pong']);
    expect(errors).toEqual([]);
    expect(exits).toEqual([]);
    expect(launched).toBe(false);
  });

  it('calls launch when no argument is passed', async () => {
    let launched = false;
    await run([], {
      launch: async () => {
        launched = true;
      },
    });
    expect(launched).toBe(true);
  });
});
