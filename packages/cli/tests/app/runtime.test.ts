import { describe, it, expect } from 'bun:test';
import { createRuntime } from '../../src/app/runtime.js';
import type { ModelPort } from '@steward/agent';

describe('cli/runtime — createRuntime Composition Root', () => {
  it('instantiates AI and satisfies ModelPort interface structurally', () => {
    const runtime = createRuntime();
    expect(runtime.ai).toBeDefined();
    expect(runtime.modelPort).toBeDefined();

    // Verify ModelPort stream signature
    const port: ModelPort = runtime.modelPort;
    expect(typeof port.stream).toBe('function');
  });

  it('provides configured providers list and dynamic models query', async () => {
    const runtime = createRuntime();
    const providers = runtime.ai.providers();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers.some((p) => p.id === 'anthropic')).toBe(true);
    expect(providers.some((p) => p.id === 'openai')).toBe(true);
    expect(providers.some((p) => p.id === 'google')).toBe(true);
  });
});
