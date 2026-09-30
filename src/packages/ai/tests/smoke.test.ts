import { describe, it, expect } from 'bun:test';

/**
 * Smoke test — verifies the @steward/ai package entry point can be imported
 * and its core exports are present. Runs fully offline with no real HTTP.
 */
describe('@steward/ai smoke', () => {
  it('exports AIError', async () => {
    const { AIError } = await import('../src/index.ts');
    expect(AIError).toBeDefined();
    expect(typeof AIError).toBe('function');
  });

  it('exports core types (compile-time check — runtime shape)', async () => {
    const mod = await import('../src/index.ts');
    // These will be present if the module resolves correctly
    expect(mod).toBeDefined();
  });
});
