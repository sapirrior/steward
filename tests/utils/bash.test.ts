import { describe, expect, it } from 'bun:test';
import { executeDirectBash } from '../../src/app/utils/bash.js';

describe('Direct Bash Execution Utility (src/app/utils/bash.ts)', () => {
  it('executes a command and returns output with live streaming chunks', async () => {
    const chunks: string[] = [];
    const result = await executeDirectBash({
      command: 'echo "hello direct bash"',
      onChunk: (chunk) => {
        chunks.push(chunk);
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('hello direct bash');
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('hello direct bash');
  });

  it('captures non-zero exit codes properly', async () => {
    const result = await executeDirectBash({
      command: 'exit 42',
    });

    expect(result.exitCode).toBe(42);
  });

  it('aborts execution when abortSignal fires', async () => {
    const controller = new AbortController();
    const promise = executeDirectBash({
      command: 'sleep 5',
      abortSignal: controller.signal,
    });

    setTimeout(() => {
      controller.abort();
    }, 50);

    const result = await promise;
    expect(result.exitCode).not.toBe(0);
  });
});
