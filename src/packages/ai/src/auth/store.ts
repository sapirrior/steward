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

export class FileCredentialStore implements CredentialStore {
  private readonly dirPath: string;
  private readonly filePath: string;
  private mutex = Promise.resolve();

  constructor(options?: FileCredentialStoreOptions) {
    this.dirPath = options?.storageDir ?? path.join(os.homedir(), '.steward');
    this.filePath = options?.filePath ?? path.join(this.dirPath, 'auth.json');
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.dirPath, { recursive: true, mode: 0o700 });
      await fs.chmod(this.dirPath, 0o700).catch(() => {});
    } catch {
      // Ignore if already exists
    }
  }

  private async loadData(): Promise<AuthStorageSchema> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !parsed.credentials) {
        throw new AIError('Invalid or corrupt auth.json schema.', { code: 'auth' });
      }
      return parsed as AuthStorageSchema;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return { version: 1, credentials: {} };
      }
      if (err instanceof AIError) throw err;
      throw new AIError(`Failed to read auth store: ${err.message}`, {
        code: 'auth',
        cause: err,
      });
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
    } catch (err: any) {
      await fs.unlink(tempFile).catch(() => {});
      throw new AIError(`Failed to atomically save auth store: ${err.message}`, {
        code: 'auth',
        cause: err,
      });
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
    // In-process serialized lock
    return new Promise((resolve, reject) => {
      this.mutex = this.mutex.then(async () => {
        try {
          const data = await this.loadData();
          const current = data.credentials[provider];
          const updated = await fn(current);

          if (updated) {
            data.credentials[provider] = updated;
          } else {
            delete data.credentials[provider];
          }

          await this.saveData(data);
          resolve(updated);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  public async delete(provider: ProviderId): Promise<void> {
    await this.modify(provider, async () => undefined);
  }
}

export function createFileCredentialStore(options?: FileCredentialStoreOptions): CredentialStore {
  return new FileCredentialStore(options);
}
