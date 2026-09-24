import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileCredentialStore } from '../../src/packages/ai/src/auth/store.js';

describe('FileCredentialStore', () => {
  it('reads and writes OAuth credentials securely', async () => {
    const tmpDir = path.join(os.tmpdir(), `steward-auth-test-${Date.now()}`);
    const store = new FileCredentialStore({ storageDir: tmpDir });

    const cred = await store.read('anthropic');
    expect(cred).toBeUndefined();

    await store.modify('anthropic', async () => ({
      type: 'oauth',
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      expiresAt: Date.now() + 3600000,
    }));

    const readBack = await store.read('anthropic');
    expect(readBack).toBeDefined();
    expect(readBack?.accessToken).toBe('test-token');

    const list = await store.list();
    expect(list.length).toBe(1);
    expect(list[0]?.provider).toBe('anthropic');

    await store.delete('anthropic');
    const afterDelete = await store.read('anthropic');
    expect(afterDelete).toBeUndefined();

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
