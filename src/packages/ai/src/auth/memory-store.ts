/**
 * @steward/ai - In-memory credential store
 *
 * For use in tests and environments where file persistence is not needed.
 * Thread-safe within a single JS process via per-id promise chains.
 * fn returning undefined in modify() = leave credential unchanged.
 */

import type { Credential, CredentialInfo, CredentialStore } from './types.js';
import type { ProviderId } from '../types.js';

export class InMemoryCredentialStore implements CredentialStore {
  private store = new Map<ProviderId, Credential>();
  /** Per-id serialization chains (avoids race conditions in modify). */
  private chains = new Map<ProviderId, Promise<unknown>>();

  async read(provider: ProviderId): Promise<Credential | undefined> {
    return this.store.get(provider);
  }

  async list(): Promise<readonly CredentialInfo[]> {
    return [...this.store.entries()].map(([provider, cred]) => ({
      provider,
      type: cred.type,
      expiresAt: cred.type === 'oauth' ? cred.expiresAt : undefined,
    }));
  }

  modify(
    provider: ProviderId,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    const chain = this.chains.get(provider) ?? Promise.resolve();
    const next = chain.then(async () => {
      const current = this.store.get(provider);
      const result = await fn(current);
      // undefined = leave unchanged (not delete)
      if (result !== undefined) {
        this.store.set(provider, result);
      }
      return result;
    });
    this.chains.set(provider, next.catch(() => {}));
    return next;
  }

  async delete(provider: ProviderId): Promise<void> {
    this.store.delete(provider);
    this.chains.delete(provider);
  }
}
