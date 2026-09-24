import { describe, expect, it } from 'bun:test';
import { generatePKCE } from '../../src/packages/ai/src/auth/pkce.js';

describe('PKCE Generator', () => {
  it('generates valid verifier and base64url challenge', async () => {
    const { verifier, challenge } = await generatePKCE();

    expect(verifier).toBeDefined();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toBeDefined();
    expect(challenge.length).toBeGreaterThanOrEqual(43);

    // Verify URL safe characters
    expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true);
    expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true);
  });

  it('generates unique verifiers on consecutive runs', async () => {
    const pkce1 = await generatePKCE();
    const pkce2 = await generatePKCE();

    expect(pkce1.verifier).not.toBe(pkce2.verifier);
    expect(pkce1.challenge).not.toBe(pkce2.challenge);
  });
});
