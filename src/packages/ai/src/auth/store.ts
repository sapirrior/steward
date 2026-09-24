/**
 * @steward/ai - Secure Credential Store (~/.steward/auth.json)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CredentialInfo, CredentialStore, OAuthCredential } from './types.js';
import type { ProviderId } from '../types.js';
import { AIError } from '../errors.js';

interface AuthStorageSchema {
  version: 1;
  credentials: Partial<Record<ProviderId, OAuthCredential>>;
}

export interface FileCredentialStoreOptions {
  storageDir?: string;
  filePath?: string;
}

const fileMutexes = new Map<string, Promise<unknown>>();

function validateAuthStorage(data: unknown): data is AuthStorageSchema {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const root = data as Record<string, unknown>;
  if (root.version !== 1) {
    return false;
  }

  if (
    !root.credentials ||
    typeof root.credentials !== 'object' ||
    Array.isArray(root.credentials)
  ) {
    return false;
  }

  const credentials = root.credentials as Record<string, unknown>;
  for (const [_, cred] of Object.entries(credentials)) {
    if (!cred || typeof cred !== 'object' || Array.isArray(cred)) {
      return false;
    }
    const c = cred as Record<string, unknown>;
    if (c.type !== 'oauth') {
      return false;
    }
    if (typeof c.accessToken !== 'string') {
      return false;
    }
    if (
      c.refreshToken !== undefined &&
      c.refreshToken !== null &&
      typeof c.refreshToken !== 'string'
    ) {
      return false;
    }
    if (c.expiresAt !== undefined && c.expiresAt !== null && typeof c.expiresAt !== 'number') {
      return false;
    }
  }

  return true;
}

export class FileCredentialStore implements CredentialStore {
  private readonly dirPath: string;
  private readonly filePath: string;
  private readonly canonicalPath: string;

  constructor(options?: FileCredentialStoreOptions) {
    this.dirPath = options?.storageDir ?? path.join(os.homedir(), '.steward');
    this.filePath = options?.filePath ?? path.join(this.dirPath, 'auth.json');
    this.canonicalPath = path.resolve(this.filePath);
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dirPath, { recursive: true, mode: 0o700 });
      await fs.chmod(this.dirPath, 0o700).catch(() => {});
    } catch (err: unknown) {
      const isExist = (err as { code?: string })?.code === 'EEXIST';
      if (!isExist) {
        throw new AIError(
          `Failed to create directory "${this.dirPath}": ${err instanceof Error ? err.message : String(err)}`,
          {
            code: 'auth',
            cause: err,
          },
        );
      }
    }
  }

  private async loadData(): Promise<AuthStorageSchema> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (jsonErr) {
        throw new AIError('Invalid or corrupt auth.json schema.', {
          code: 'auth',
          cause: jsonErr,
        });
      }

      if (!validateAuthStorage(parsed)) {
        throw new AIError('Invalid or corrupt auth.json schema.', { code: 'auth' });
      }

      for (const cred of Object.values(parsed.credentials)) {
        if (cred) {
          if ((cred as { expiresAt?: unknown }).expiresAt === null) {
            delete (cred as { expiresAt?: unknown }).expiresAt;
          }
          if ((cred as { refreshToken?: unknown }).refreshToken === null) {
            delete (cred as { refreshToken?: unknown }).refreshToken;
          }
        }
      }

      return parsed;
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'ENOENT') {
        return { version: 1, credentials: {} };
      }
      if (err instanceof AIError) throw err;
      throw new AIError(
        `Failed to read auth store: ${err instanceof Error ? err.message : String(err)}`,
        {
          code: 'auth',
          cause: err,
        },
      );
    }
  }

  private async saveData(data: AuthStorageSchema): Promise<void> {
    await this.ensureDirectory();
    const tempFile = path.join(
      this.dirPath,
      `.auth.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}`,
    );

    const json = JSON.stringify(data, null, 2);
    try {
      await fs.writeFile(tempFile, json, { encoding: 'utf-8', mode: 0o600 });
      await fs.chmod(tempFile, 0o600).catch(() => {});
      await fs.rename(tempFile, this.filePath);
      await fs.chmod(this.filePath, 0o600).catch(() => {});
    } catch (err: unknown) {
      await fs.unlink(tempFile).catch(() => {});
      throw new AIError(
        `Failed to atomically save auth store: ${err instanceof Error ? err.message : String(err)}`,
        {
          code: 'auth',
          cause: err,
        },
      );
    }
  }

  public async read(provider: ProviderId): Promise<OAuthCredential | undefined> {
    const data = await this.loadData();
    return data.credentials[provider];
  }

  public async list(): Promise<readonly CredentialInfo[]> {
    const data = await this.loadData();
    const list: CredentialInfo[] = [];
    for (const [provider, cred] of Object.entries(data.credentials)) {
      if (cred && cred.type === 'oauth') {
        list.push({
          provider: provider as ProviderId,
          type: 'oauth',
          expiresAt: cred.expiresAt,
        });
      }
    }
    return list;
  }

  public async modify(
    provider: ProviderId,
    fn: (current: OAuthCredential | undefined) => Promise<OAuthCredential | undefined>,
  ): Promise<OAuthCredential | undefined> {
    const currentMutex = fileMutexes.get(this.canonicalPath) ?? Promise.resolve();
    const nextMutex = currentMutex.then(async () => {
      const data = await this.loadData();
      const current = data.credentials[provider];
      const updated = await fn(current);

      if (updated) {
        data.credentials[provider] = updated;
      } else {
        delete data.credentials[provider];
      }

      await this.saveData(data);
      return updated;
    });

    fileMutexes.set(
      this.canonicalPath,
      nextMutex.catch(() => {}),
    );

    return await nextMutex;
  }

  public async delete(provider: ProviderId): Promise<void> {
    await this.modify(provider, async () => undefined);
  }
}

export function createFileCredentialStore(options?: FileCredentialStoreOptions): CredentialStore {
  return new FileCredentialStore(options);
}
